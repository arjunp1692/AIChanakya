import type { TicketAssignee } from "@prisma/client";
import { addAssigneeSchema, removeAssigneeSchema, updateContributionSchema } from "@/lib/schemas/ticket";
import { isOpenStatus } from "@/lib/ticket-utils";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, ForbiddenError, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { resourceInclude, toTicketResource } from "./detail";
import { TicketInputError } from "./service";
import { dbOf, inTx, type ServiceOpts } from "./tx";

async function loadTicket(ticketId: string, opts: ServiceOpts = {}) {
  const ticket = await dbOf(opts).ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  return { ticket, resource: toTicketResource(ticket) };
}

const pick = (a: TicketAssignee) => ({
  userId: a.userId,
  responsibility: a.responsibility,
  contributionStatus: a.contributionStatus,
  progress: a.progress,
  note: a.note,
});

/**
 * Adds a co-assignee from any department. Needs `ticket.assign`; the owner can never be a
 * co-assignee (exactly one owner). ASSIGNEE_ADDED event + ActivityLog CREATE in one transaction.
 */
export async function addAssignee(user: AuthzUser, ticketId: string, input: unknown, opts: ServiceOpts = {}) {
  const data = addAssigneeSchema.parse(input);
  const { ticket, resource } = await loadTicket(ticketId, opts);
  assertCan(user, "ticket.assign", resource);
  if (!isOpenStatus(ticket.status)) throw new TicketInputError("userId", "Co-assignees can only be added to an open ticket");
  if (data.userId === ticket.ownerId) {
    throw new TicketInputError("userId", "The owner cannot also be a co-assignee");
  }
  if (resource.assigneeIds?.includes(data.userId)) {
    throw new TicketInputError("userId", "Already a co-assignee on this ticket");
  }
  const person = await prisma.user.findFirst({ where: { id: data.userId, active: true } });
  if (!person) throw new TicketInputError("userId", "Choose an active user");

  return inTx(opts, async (tx) => {
    const row = await tx.ticketAssignee.create({
      data: { ticketId: ticket.id, userId: person.id, responsibility: data.responsibility },
    });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "ASSIGNEE_ADDED",
      field: "assignee",
      to: person.id,
      reason: data.responsibility,
      reportId: opts.reportId,
    });
    await logActivity(tx, { actor: user.id, entity: "TicketAssignee", entityId: row.id, action: "CREATE", after: pick(row) });
    return row;
  });
}

/** Removes a co-assignee. Needs `ticket.assign`. ASSIGNEE_REMOVED event + ActivityLog DELETE. */
export async function removeAssignee(user: AuthzUser, ticketId: string, input: unknown) {
  const data = removeAssigneeSchema.parse(input);
  const { ticket, resource } = await loadTicket(ticketId);
  assertCan(user, "ticket.assign", resource);
  const row = await prisma.ticketAssignee.findFirst({ where: { id: data.assigneeId, ticketId: ticket.id } });
  if (!row) throw new TicketInputError("assigneeId", "Unknown co-assignee");

  return prisma.$transaction(async (tx) => {
    await tx.ticketAssignee.delete({ where: { id: row.id } });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "ASSIGNEE_REMOVED",
      field: "assignee",
      from: row.userId,
    });
    await logActivity(tx, { actor: user.id, entity: "TicketAssignee", entityId: row.id, action: "DELETE", before: pick(row) });
    return row;
  });
}

/**
 * A co-assignee updates their own contribution (status, progress, note). Needs `ticket.contribute`
 * and the row must be the caller's own: nobody edits another person's contribution.
 * CONTRIBUTION event (from/to = {status, progress}, reason = note) + ActivityLog UPDATE.
 */
export async function updateContribution(user: AuthzUser, ticketId: string, input: unknown) {
  const data = updateContributionSchema.parse(input);
  const { ticket, resource } = await loadTicket(ticketId);
  assertCan(user, "ticket.contribute", resource);
  const row = await prisma.ticketAssignee.findFirst({ where: { id: data.assigneeId, ticketId: ticket.id } });
  if (!row) throw new TicketInputError("assigneeId", "Unknown co-assignee");
  if (row.userId !== user.id) throw new ForbiddenError("ticket.contribute");
  if (!isOpenStatus(ticket.status)) {
    throw new TicketInputError("contributionStatus", "Contributions can only change on an open ticket");
  }

  const progress = data.contributionStatus === "DONE" ? 100 : data.progress;
  const note = data.note ?? null;
  if (row.contributionStatus === data.contributionStatus && row.progress === progress && row.note === note) return row;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticketAssignee.update({
      where: { id: row.id },
      data: { contributionStatus: data.contributionStatus, progress, note },
    });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "CONTRIBUTION",
      field: "contribution",
      from: { status: row.contributionStatus, progress: row.progress },
      to: { status: updated.contributionStatus, progress: updated.progress },
      reason: note ?? undefined,
    });
    await logActivity(tx, {
      actor: user.id,
      entity: "TicketAssignee",
      entityId: row.id,
      action: "UPDATE",
      before: pick(row),
      after: pick(updated),
    });
    return updated;
  });
}
