import type { Prisma, TicketDependency, TicketStatus } from "@prisma/client";
import { CLOSED_STATUSES } from "@/lib/constants";
import { addDependencySchema, dependencyIdSchema } from "@/lib/schemas/ticket";
import { isOpenStatus } from "@/lib/ticket-utils";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, can, ticketVisibilityWhere, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { resourceInclude, toTicketResource } from "./detail";
import { TicketInputError } from "./service";
import { dbOf, inTx, type ServiceOpts, type Tx } from "./tx";

/** A dependency is resolved when its external prerequisite is marked so, or its linked ticket is closed. */
export function isDependencyResolved(d: { resolved: boolean; dependsOnTicket?: { status: TicketStatus } | null }) {
  return d.dependsOnTicket ? CLOSED_STATUSES.includes(d.dependsOnTicket.status) : d.resolved;
}

/** SQL mirror of `!isDependencyResolved` for `TicketDependency` filters and relation counts. */
export const unresolvedDependencyWhere = {
  OR: [
    { dependsOnTicketId: null, resolved: false },
    { dependsOnTicket: { status: { notIn: [...CLOSED_STATUSES] } } },
  ],
} satisfies Prisma.TicketDependencyWhereInput;

async function loadTicket(ticketId: string, opts: ServiceOpts = {}) {
  const ticket = await dbOf(opts).ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  return { ticket, resource: toTicketResource(ticket) };
}

const pick = (d: TicketDependency) => ({
  ticketId: d.ticketId,
  dependsOnTicketId: d.dependsOnTicketId,
  externalPrerequisite: d.externalPrerequisite,
  resolved: d.resolved,
});

/**
 * True if `fromId` already (transitively) depends on `toId`, i.e. adding `toId → fromId`
 * would close a loop. Graph walk over ticket→ticket edges, one query per frontier level.
 */
async function reaches(tx: Tx, fromId: string, toId: string): Promise<boolean> {
  const seen = new Set<string>([fromId]);
  let frontier = [fromId];
  while (frontier.length) {
    const edges = await tx.ticketDependency.findMany({
      where: { ticketId: { in: frontier }, dependsOnTicketId: { not: null } },
      select: { dependsOnTicketId: true },
    });
    frontier = [];
    for (const { dependsOnTicketId: next } of edges) {
      if (!next) continue;
      if (next === toId) return true;
      if (!seen.has(next)) {
        seen.add(next);
        frontier.push(next);
      }
    }
  }
  return false;
}

/**
 * Adds a dependency to `ticketId` (the waiting ticket): another visible ticket by ticket ID, or an
 * external prerequisite. Needs `ticket.edit` on the waiting ticket and `ticket.view` on the target.
 * Rejects self-dependency, duplicates and cycles. DEPENDENCY_ADDED (+ DEPENDENT_ADDED on the target)
 * and ActivityLog CREATE in one transaction.
 */
export async function addDependency(user: AuthzUser, ticketId: string, input: unknown, opts: ServiceOpts = {}) {
  const data = addDependencySchema.parse(input);
  const { ticket, resource } = await loadTicket(ticketId, opts);
  assertCan(user, "ticket.edit", resource);
  if (!isOpenStatus(ticket.status)) {
    throw new TicketInputError(data.kind === "ticket" ? "dependsOn" : "externalPrerequisite", "Dependencies can only be added to an open ticket");
  }

  if (data.kind === "external") {
    return inTx(opts, async (tx) => {
      const row = await tx.ticketDependency.create({
        data: { ticketId: ticket.id, externalPrerequisite: data.externalPrerequisite! },
      });
      await recordTicketEvent(tx, {
        ticketId: ticket.id,
        actor: user.id,
        type: "DEPENDENCY_ADDED",
        field: "dependency",
        to: row.externalPrerequisite,
        reportId: opts.reportId,
      });
      await logActivity(tx, { actor: user.id, entity: "TicketDependency", entityId: row.id, action: "CREATE", after: pick(row) });
      return row;
    });
  }

  const ref = data.dependsOn!.toUpperCase();
  const target = await prisma.ticket.findUnique({ where: { ticketNo: ref }, include: resourceInclude });
  if (!target || !can(user, "ticket.view", toTicketResource(target))) {
    throw new TicketInputError("dependsOn", "Unknown ticket ID");
  }
  if (target.id === ticket.id) throw new TicketInputError("dependsOn", "A ticket cannot depend on itself");

  return inTx(opts, async (tx) => {
    const existing = await tx.ticketDependency.findFirst({ where: { ticketId: ticket.id, dependsOnTicketId: target.id } });
    if (existing) throw new TicketInputError("dependsOn", `Already waiting on ${target.ticketNo}`);
    if (await reaches(tx, target.id, ticket.id)) {
      throw new TicketInputError("dependsOn", `${target.ticketNo} already depends on ${ticket.ticketNo}; this would create a cycle`);
    }
    const row = await tx.ticketDependency.create({ data: { ticketId: ticket.id, dependsOnTicketId: target.id } });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "DEPENDENCY_ADDED",
      field: "dependency",
      to: target.ticketNo,
      reportId: opts.reportId,
    });
    await recordTicketEvent(tx, {
      ticketId: target.id,
      actor: user.id,
      type: "DEPENDENT_ADDED",
      field: "dependent",
      to: ticket.ticketNo,
    });
    await logActivity(tx, { actor: user.id, entity: "TicketDependency", entityId: row.id, action: "CREATE", after: pick(row) });
    return row;
  });
}

async function loadDependency(user: AuthzUser, ticketId: string, input: unknown) {
  const data = dependencyIdSchema.parse(input);
  const { ticket, resource } = await loadTicket(ticketId);
  assertCan(user, "ticket.edit", resource);
  const row = await prisma.ticketDependency.findFirst({
    where: { id: data.dependencyId, ticketId: ticket.id },
    include: { dependsOnTicket: { select: { id: true, ticketNo: true } } },
  });
  if (!row) throw new TicketInputError("dependencyId", "Unknown dependency");
  return { ticket, row };
}

/** Removes a dependency. Needs `ticket.edit` on the waiting ticket. DEPENDENCY_REMOVED (+ DEPENDENT_REMOVED) + ActivityLog DELETE. */
export async function removeDependency(user: AuthzUser, ticketId: string, input: unknown) {
  const { ticket, row } = await loadDependency(user, ticketId, input);
  return prisma.$transaction(async (tx) => {
    await tx.ticketDependency.delete({ where: { id: row.id } });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "DEPENDENCY_REMOVED",
      field: "dependency",
      from: row.dependsOnTicket?.ticketNo ?? row.externalPrerequisite,
    });
    if (row.dependsOnTicket) {
      await recordTicketEvent(tx, {
        ticketId: row.dependsOnTicket.id,
        actor: user.id,
        type: "DEPENDENT_REMOVED",
        field: "dependent",
        from: ticket.ticketNo,
      });
    }
    await logActivity(tx, { actor: user.id, entity: "TicketDependency", entityId: row.id, action: "DELETE", before: pick(row) });
    return row;
  });
}

/** Marks an external prerequisite resolved. Needs `ticket.edit`. DEPENDENCY_RESOLVED + ActivityLog UPDATE. */
export async function resolveDependency(user: AuthzUser, ticketId: string, input: unknown) {
  const { ticket, row } = await loadDependency(user, ticketId, input);
  if (row.dependsOnTicketId) {
    throw new TicketInputError("dependencyId", "Ticket dependencies resolve when that ticket is closed");
  }
  if (row.resolved) return row;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticketDependency.update({ where: { id: row.id }, data: { resolved: true } });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "DEPENDENCY_RESOLVED",
      field: "dependency",
      to: row.externalPrerequisite,
    });
    await logActivity(tx, {
      actor: user.id,
      entity: "TicketDependency",
      entityId: row.id,
      action: "UPDATE",
      before: pick(row),
      after: pick(updated),
    });
    return updated;
  });
}

/** Up to 8 tickets visible to `user` matching `q` (ID or title) that `ticketId` could wait on. */
export async function searchDependencyTargets(user: AuthzUser, ticketId: string, q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  const linked = await prisma.ticketDependency.findMany({
    where: { ticketId, dependsOnTicketId: { not: null } },
    select: { dependsOnTicketId: true },
  });
  return prisma.ticket.findMany({
    where: {
      AND: [
        ticketVisibilityWhere(user),
        { id: { notIn: [ticketId, ...linked.map((l) => l.dependsOnTicketId!)] } },
        {
          OR: [
            { ticketNo: { contains: term, mode: "insensitive" } },
            { title: { contains: term, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: { ticketNo: true, title: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
}

export type DependencyGraphFilter = {
  /** Restrict to tickets this user can see (both ends of a ticket edge). Omit for system jobs. */
  user?: AuthzUser;
  /** Only edges touching one of these departments (either end). */
  departmentIds?: string[];
  /** Only edges whose waiting ticket is open (default true). */
  openOnly?: boolean;
  /** Only unresolved edges. */
  unresolvedOnly?: boolean;
};

const nodeSelect = {
  id: true,
  ticketNo: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  departmentId: true,
  department: { select: { code: true } },
} satisfies Prisma.TicketSelect;

export type DependencyNode = Prisma.TicketGetPayload<{ select: typeof nodeSelect }>;
export type DependencyEdge = {
  id: string;
  /** The waiting ticket. */
  fromId: string;
  /** The ticket waited on; null for an external prerequisite. */
  toId: string | null;
  external: string | null;
  resolved: boolean;
  createdAt: Date;
};

/**
 * Dependency graph for cross-department analysis (S30 bottleneck detection reuses this).
 * Nodes are keyed by ticket ID; edges point from the waiting ticket to what it waits on.
 */
export async function getDependencyGraph(filter: DependencyGraphFilter = {}) {
  const and: Prisma.TicketDependencyWhereInput[] = [];
  if (filter.openOnly ?? true) and.push({ ticket: { status: { notIn: [...CLOSED_STATUSES] } } });
  if (filter.unresolvedOnly) and.push(unresolvedDependencyWhere);
  if (filter.user) {
    const visible = ticketVisibilityWhere(filter.user);
    // `is:` is required: a bare `{}` relation filter inside OR does not match every row.
    and.push({ ticket: { is: visible } }, { OR: [{ dependsOnTicketId: null }, { dependsOnTicket: { is: visible } }] });
  }
  if (filter.departmentIds?.length) {
    const dept = { departmentId: { in: filter.departmentIds } };
    and.push({ OR: [{ ticket: dept }, { dependsOnTicket: dept }] });
  }

  const rows = await prisma.ticketDependency.findMany({
    where: { AND: and },
    include: { ticket: { select: nodeSelect }, dependsOnTicket: { select: nodeSelect } },
    orderBy: { createdAt: "asc" },
  });

  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = rows.map((r) => {
    nodes.set(r.ticket.id, r.ticket);
    if (r.dependsOnTicket) nodes.set(r.dependsOnTicket.id, r.dependsOnTicket);
    return {
      id: r.id,
      fromId: r.ticketId,
      toId: r.dependsOnTicketId,
      external: r.externalPrerequisite,
      resolved: isDependencyResolved(r),
      createdAt: r.createdAt,
    };
  });
  return { nodes, edges };
}
