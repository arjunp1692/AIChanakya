import type { Prisma } from "@prisma/client";
import { CLOSED_STATUSES } from "@/lib/constants";
import type { TicketFilters, TicketSortKey } from "@/lib/schemas/ticket-filters";
import { isOverdue } from "@/lib/ticket-utils";
import { ticketVisibilityWhere, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";

export const TICKET_PAGE_SIZE = 25;

/** SQL mirror of `isOverdue` (src/lib/ticket-utils.ts). */
export function overdueWhere(now = new Date()): Prisma.TicketWhereInput {
  return { status: { notIn: [...CLOSED_STATUSES] }, dueDate: { lt: now } };
}

const range = (from?: Date, to?: Date): Prisma.DateTimeFilter | undefined =>
  from || to ? { ...(from && { gte: from }), ...(to && { lte: to }) } : undefined;

/** Filter part only — callers must AND it with `ticketVisibilityWhere`. */
export function ticketFilterWhere(f: Partial<TicketFilters>, now = new Date()): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [];
  if (f.q) {
    and.push({
      OR: [
        { ticketNo: { contains: f.q, mode: "insensitive" } },
        { title: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  if (f.dept?.length) and.push({ department: { code: { in: f.dept } } });
  if (f.owner) and.push({ ownerId: f.owner });
  if (f.assignee) and.push({ assignees: { some: { userId: f.assignee } } });
  if (f.status?.length) and.push({ status: { in: f.status } });
  if (f.priority?.length) and.push({ priority: { in: f.priority } });
  if (f.overdue) and.push(overdueWhere(now));
  const created = range(f.createdFrom, f.createdTo);
  if (created) and.push({ createdAt: created });
  const completed = range(f.completedFrom, f.completedTo);
  if (completed) and.push({ completedAt: completed });
  if (f.ids?.length) and.push({ OR: [{ ticketNo: { in: f.ids } }, { id: { in: f.ids } }] });
  return and.length ? { AND: and } : {};
}

/** Visibility rules AND the filters. Use this for every count/list derived from filters. */
export function ticketListWhere(user: AuthzUser, f: Partial<TicketFilters>, now = new Date()): Prisma.TicketWhereInput {
  return { AND: [ticketVisibilityWhere(user), ticketFilterWhere(f, now)] };
}

function orderBy(sort: TicketSortKey, dir: "asc" | "desc"): Prisma.TicketOrderByWithRelationInput[] {
  const primary: Prisma.TicketOrderByWithRelationInput =
    sort === "department"
      ? { department: { code: dir } }
      : sort === "owner"
        ? { owner: { name: dir } }
        : sort === "dueDate"
          ? { dueDate: { sort: dir, nulls: "last" } }
          : { [sort]: dir };
  return [primary, { id: "asc" }];
}

const listSelect = {
  id: true,
  ticketNo: true,
  title: true,
  priority: true,
  status: true,
  progress: true,
  dueDate: true,
  updatedAt: true,
  confidential: true,
  department: { select: { code: true, name: true } },
  owner: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

export type TicketListRow = Prisma.TicketGetPayload<{ select: typeof listSelect }> & { overdue: boolean };

export type TicketListResult = {
  rows: TicketListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** Tickets visible to `user` matching `filters`, paginated and sorted server-side. */
export async function listTickets(
  user: AuthzUser,
  filters: Partial<TicketFilters>,
  opts: { pageSize?: number; now?: Date } = {},
): Promise<TicketListResult> {
  const now = opts.now ?? new Date();
  const pageSize = opts.pageSize ?? TICKET_PAGE_SIZE;
  const where = ticketListWhere(user, filters, now);
  const total = await prisma.ticket.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await prisma.ticket.findMany({
    where,
    select: listSelect,
    orderBy: orderBy(filters.sort ?? "updatedAt", filters.dir ?? "desc"),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return {
    rows: rows.map((r) => ({ ...r, overdue: isOverdue(r, now) })),
    total,
    page,
    pageSize,
    pageCount,
  };
}
