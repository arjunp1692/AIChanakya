import type { Priority, Prisma, Role, Ticket, TicketStatus } from "@prisma/client";
import { changeStatusSchema, updateProgressSchema } from "@/lib/schemas/ticket";
import { isOpenStatus } from "@/lib/ticket-utils";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, can, ForbiddenError, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { getSettingValue } from "@/server/settings";
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

/** Validator sending an AWAITING_APPROVAL ticket back to work. */
export const isRejection = (from: TicketStatus, to: TicketStatus) => from === "AWAITING_APPROVAL" && to === "IN_PROGRESS";

/** Whether moving `from` → `to` needs a reason (blocker, cancellation, reopen, validation rejection). */
export const needsReason = (from: TicketStatus, to: TicketStatus) =>
  to === "BLOCKED" || to === "CANCELLED" || isReopen(from, to) || isRejection(from, to);

/**
 * Next statuses offered to this user (assumes `ticket.changeStatus` was already checked).
 * Only validators (`ticket.validate`) move a ticket out of AWAITING_APPROVAL.
 */
export function allowedNextStatuses(user: AuthzUser, from: TicketStatus, canValidate = false): TicketStatus[] {
  if (from === "AWAITING_APPROVAL" && !canValidate) return [];
  return TRANSITIONS[from].filter((to) => !isReopen(from, to) || REOPEN_ROLES.includes(user.role));
}

const DEFAULT_STRICT_PRIORITIES: Priority[] = ["CRITICAL", "HIGH"];

async function prioritySetting(key: string): Promise<Priority[]> {
  const value = await getSettingValue(key);
  return Array.isArray(value) ? (value as Priority[]) : DEFAULT_STRICT_PRIORITIES;
}

/**
 * Completion policy for a priority, from Settings `completion.requireEvidence` and
 * `completion.requireValidation` (both default CRITICAL, HIGH).
 */
export async function completionPolicy(priority: Priority) {
  const [evidence, validation] = await Promise.all([
    prioritySetting("completion.requireEvidence"),
    prioritySetting("completion.requireValidation"),
  ]);
  return { evidenceRequired: evidence.includes(priority), validationRequired: validation.includes(priority) };
}

/** Refuses completion (or submission for validation) without an evidence attachment. Runs in the tx. */
async function assertEvidence(tx: Prisma.TransactionClient, ticket: Ticket) {
  const count = await tx.attachment.count({ where: { ticketId: ticket.id, isEvidence: true } });
  if (count === 0) {
    throw new TicketInputError(
      "status",
      "Attach evidence first: upload a file or add a link marked as evidence (required for this priority)",
    );
  }
}

/**
 * Moves a ticket along the lifecycle. Needs `ticket.changeStatus`; reopen also needs HOD+; leaving
 * AWAITING_APPROVAL needs `ticket.validate`. Completion follows `completionPolicy`: evidence required,
 * and a non-validator's completion is submitted to AWAITING_APPROVAL (validatedBy/At set on COMPLETED).
 * Writes the status change, a STATUS_CHANGED (or REOPENED) event with the reason, and an
 * ActivityLog UPDATE in one transaction. Throws ZodError, TicketInputError or ForbiddenError.
 */
export async function changeStatus(user: AuthzUser, ticketId: string, input: unknown) {
  const data = changeStatusSchema.parse(input);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  const resource = toTicketResource(ticket);
  assertCan(user, "ticket.changeStatus", resource);

  const from = ticket.status;
  if (!TRANSITIONS[from].includes(data.status)) {
    throw new TicketInputError("status", `Cannot move a ticket from ${from} to ${data.status}`);
  }
  const canValidate = can(user, "ticket.validate", resource);
  if (from === "AWAITING_APPROVAL" && !canValidate) throw new ForbiddenError("ticket.validate");
  const policy = await completionPolicy(ticket.priority);
  // A non-validator completing a ticket whose priority needs validation submits it for validation instead.
  const submit = data.status === "COMPLETED" && policy.validationRequired && !canValidate;
  const to: TicketStatus = submit ? "AWAITING_APPROVAL" : data.status;

  const reopen = isReopen(from, to);
  if (reopen && !REOPEN_ROLES.includes(user.role)) throw new ForbiddenError("ticket.changeStatus");
  if (needsReason(from, to) && !data.reason) {
    const what =
      to === "BLOCKED"
        ? "what is blocking this ticket"
        : reopen
          ? "why it is reopened"
          : isRejection(from, to)
            ? "why the completion is rejected"
            : "why it is cancelled";
    throw new TicketInputError("reason", `Give a reason: ${what}`);
  }

  const now = new Date();
  const changes: Prisma.TicketUncheckedUpdateManyInput = { status: to };
  if (to === "BLOCKED") changes.blockerReason = data.reason;
  else if (from === "BLOCKED") changes.blockerReason = null;
  if (to === "COMPLETED") Object.assign(changes, { completedAt: now, progress: 100 });
  // Validated: completed out of review, or completed directly by a validator where policy requires validation.
  if (to === "COMPLETED" && (from === "AWAITING_APPROVAL" || policy.validationRequired)) {
    Object.assign(changes, { validatedById: user.id, validatedAt: now });
  }
  if (reopen) {
    Object.assign(changes, { completedAt: null, validatedById: null, validatedAt: null, reopenCount: { increment: 1 } });
  }

  return prisma.$transaction(async (tx) => {
    if ((to === "COMPLETED" || submit) && policy.evidenceRequired) await assertEvidence(tx, ticket);
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
      reason: data.reason ?? (submit ? "Submitted for completion validation" : undefined),
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
      validatedById: t.validatedById,
      validatedAt: t.validatedAt,
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
