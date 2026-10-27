import type { Prisma, Role, Ticket, TicketStatus } from "@prisma/client";
import { changeStatusSchema, updateProgressSchema } from "@/lib/schemas/ticket";
import { isOpenStatus } from "@/lib/ticket-utils";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, ForbiddenError, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { resourceInclude, toTicketResource } from "./detail";
import { TicketInputError } from "./service";

/** The ticket lifecycle (PRD §9). Overdue is not a status; see `isOverdue`. */
export const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "AWAITING_APPROVAL", "ON_HOLD", "COMPLETED", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  AWAITING_APPROVAL: ["IN_PROGRESS", "COMPLETED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["IN_PROGRESS"],
  CANCELLED: [],
};

/** Roles allowed to reopen a completed ticket (on top of `ticket.changeStatus`). */
const REOPEN_ROLES: readonly Role[] = ["HOD", "CEO_OFFICE", "CEO"];

export const isReopen = (from: TicketStatus, to: TicketStatus) => from === "COMPLETED" && to === "IN_PROGRESS";

/** Whether moving `from` → `to` needs a reason (blocker, cancellation, reopen). */
export const needsReason = (from: TicketStatus, to: TicketStatus) =>
  to === "BLOCKED" || to === "CANCELLED" || isReopen(from, to);

/** Next statuses offered to this user (assumes `ticket.changeStatus` was already checked). */
export function allowedNextStatuses(user: AuthzUser, from: TicketStatus): TicketStatus[] {
  return TRANSITIONS[from].filter((to) => !isReopen(from, to) || REOPEN_ROLES.includes(user.role));
}

/**
 * Completion hook, run inside the transaction before a ticket becomes COMPLETED.
 * S13 adds evidence/validation rules here (throw TicketInputError to refuse).
 */
const assertCanComplete: (tx: Prisma.TransactionClient, ticket: Ticket) => Promise<void> = async () => {};

/**
 * Moves a ticket along the lifecycle. Needs `ticket.changeStatus`; reopen also needs HOD+.
 * Writes the status change, a STATUS_CHANGED (or REOPENED) event with the reason, and an
 * ActivityLog UPDATE in one transaction. Throws ZodError, TicketInputError or ForbiddenError.
 */
export async function changeStatus(user: AuthzUser, ticketId: string, input: unknown) {
  const data = changeStatusSchema.parse(input);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  assertCan(user, "ticket.changeStatus", toTicketResource(ticket));

  const from = ticket.status;
  const to = data.status;
  if (!TRANSITIONS[from].includes(to)) {
    throw new TicketInputError("status", `Cannot move a ticket from ${from} to ${to}`);
  }
  const reopen = isReopen(from, to);
  if (reopen && !REOPEN_ROLES.includes(user.role)) throw new ForbiddenError("ticket.changeStatus");
  if (needsReason(from, to) && !data.reason) {
    const what = to === "BLOCKED" ? "what is blocking this ticket" : reopen ? "why it is reopened" : "why it is cancelled";
    throw new TicketInputError("reason", `Give a reason: ${what}`);
  }

  const now = new Date();
  const changes: Prisma.TicketUncheckedUpdateManyInput = { status: to };
  if (to === "BLOCKED") changes.blockerReason = data.reason;
  else if (from === "BLOCKED") changes.blockerReason = null;
  if (to === "COMPLETED") Object.assign(changes, { completedAt: now, progress: 100 });
  if (reopen) Object.assign(changes, { completedAt: null, reopenCount: { increment: 1 } });

  return prisma.$transaction(async (tx) => {
    if (to === "COMPLETED") await assertCanComplete(tx, ticket);
    // Guard against a concurrent change: only update if the status is still `from`.
    const { count } = await tx.ticket.updateMany({ where: { id: ticket.id, status: from }, data: changes });
    if (count === 0) throw new TicketInputError("status", "The ticket was changed by someone else; reload and retry");
    const updated = await tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: reopen ? "REOPENED" : "STATUS_CHANGED",
      field: "status",
      from,
      to,
      reason: data.reason,
    });
    if (reopen) {
      await recordTicketEvent(tx, {
        ticketId: ticket.id,
        actor: user.id,
        type: "FIELD_CHANGED",
        field: "completedAt",
        from: ticket.completedAt,
        to: null,
      });
    }
    const pick = (t: Ticket) => ({
      status: t.status,
      blockerReason: t.blockerReason,
      completedAt: t.completedAt,
      progress: t.progress,
      reopenCount: t.reopenCount,
    });
    await logActivity(tx, {
      actor: user.id,
      entity: "Ticket",
      entityId: ticket.id,
      action: "UPDATE",
      before: pick(ticket),
      after: pick(updated),
    });
    return updated;
  });
}

/** Sets progress (0–100) on an open ticket. Needs `ticket.changeStatus`; PROGRESS event + ActivityLog. */
export async function updateProgress(user: AuthzUser, ticketId: string, input: unknown) {
  const data = updateProgressSchema.parse(input);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  assertCan(user, "ticket.changeStatus", toTicketResource(ticket));
  if (!isOpenStatus(ticket.status)) {
    throw new TicketInputError("progress", "Progress can only change on an open ticket");
  }
  if (data.progress === ticket.progress) return ticket;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { progress: data.progress } });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "PROGRESS",
      field: "progress",
      from: ticket.progress,
      to: updated.progress,
    });
    await logActivity(tx, {
      actor: user.id,
      entity: "Ticket",
      entityId: ticket.id,
      action: "UPDATE",
      before: { progress: ticket.progress },
      after: { progress: updated.progress },
    });
    return updated;
  });
}
