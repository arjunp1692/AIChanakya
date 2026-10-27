import type { DeadlineChange, Prisma, Role, Ticket } from "@prisma/client";
import { changeDeadlineSchema, decideDeadlineSchema } from "@/lib/schemas/ticket";
import { isOpenStatus } from "@/lib/ticket-utils";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, can, ForbiddenError, type AuthzUser, type TicketResource } from "@/server/authz";
import { prisma } from "@/server/db";
import { resourceInclude, toTicketResource } from "./detail";
import { TicketInputError } from "./service";

type Tx = Prisma.TransactionClient;

/** Roles whose deadline changes apply at once and who decide pending requests (own dept for HOD). */
const APPROVER_ROLES: readonly Role[] = ["HOD", "CEO_OFFICE", "CEO"];

/** Setting `deadline.approval`: "HOD" (default) = members' changes need approval; "NONE" = all auto-approved. */
export async function deadlineNeedsApproval(user: AuthzUser): Promise<boolean> {
  if (APPROVER_ROLES.includes(user.role)) return false;
  const row = await prisma.setting.findUnique({ where: { key: "deadline.approval" } });
  return row?.value !== "NONE";
}

/** Whether `user` may approve/reject pending deadline changes on this ticket. */
export function canDecideDeadline(user: AuthzUser, resource: TicketResource): boolean {
  return APPROVER_ROLES.includes(user.role) && can(user, "ticket.changeDeadline", resource);
}

async function loadTicket(user: AuthzUser, ticketId: string) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  const resource = toTicketResource(ticket);
  assertCan(user, "ticket.changeDeadline", resource);
  return { ticket, resource };
}

/**
 * Moves `dueDate` to the change's target inside `tx`. `originalDueDate` is only filled when the
 * ticket had none (first deadline); it is never overwritten. `extensionCount++` when moved later.
 */
async function applyChange(tx: Tx, actorId: string, ticket: Ticket, change: DeadlineChange) {
  const later = !!change.from && change.to.getTime() > change.from.getTime();
  // Guard against a concurrent change: only apply if the due date is still the request's `from`.
  const { count } = await tx.ticket.updateMany({
    where: { id: ticket.id, dueDate: change.from },
    data: {
      dueDate: change.to,
      noDeadlineReason: null,
      ...(ticket.originalDueDate ? {} : { originalDueDate: change.to }),
      ...(later ? { extensionCount: { increment: 1 } } : {}),
    },
  });
  if (count === 0) throw new TicketInputError("dueDate", "The due date was changed by someone else; reload and retry");
  const updated = await tx.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

  await recordTicketEvent(tx, {
    ticketId: ticket.id,
    actor: actorId,
    type: "DEADLINE_CHANGED",
    field: "dueDate",
    from: change.from,
    to: change.to,
    reason: change.reason,
  });
  const pick = (t: Ticket) => ({
    dueDate: t.dueDate,
    originalDueDate: t.originalDueDate,
    noDeadlineReason: t.noDeadlineReason,
    extensionCount: t.extensionCount,
  });
  await logActivity(tx, {
    actor: actorId,
    entity: "Ticket",
    entityId: ticket.id,
    action: "UPDATE",
    before: pick(ticket),
    after: pick(updated),
  });
  return updated;
}

/**
 * Requests a new due date. Reason is mandatory. HOD/CEO_OFFICE/CEO changes are auto-approved
 * (approver = self) and applied at once; members' changes stay PENDING until an approver decides
 * (Setting `deadline.approval`). Writes DeadlineChange + TicketEvent + ActivityLog in one transaction.
 */
export async function changeDeadline(user: AuthzUser, ticketId: string, input: unknown) {
  const data = changeDeadlineSchema.parse(input);
  const { ticket } = await loadTicket(user, ticketId);
  if (!isOpenStatus(ticket.status)) {
    throw new TicketInputError("dueDate", "The deadline can only change on an open ticket");
  }
  const to = data.dueDate;
  if (ticket.dueDate && ticket.dueDate.getTime() === to.getTime()) {
    throw new TicketInputError("dueDate", "That is already the due date");
  }
  if (to.getTime() < Date.now()) throw new TicketInputError("dueDate", "The new due date is in the past");

  const pending = await deadlineNeedsApproval(user);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    if (await tx.deadlineChange.count({ where: { ticketId: ticket.id, status: "PENDING" } })) {
      throw new TicketInputError("dueDate", "A deadline change is already waiting for approval");
    }
    const change = await tx.deadlineChange.create({
      data: {
        ticketId: ticket.id,
        from: ticket.dueDate,
        to,
        reason: data.reason,
        requestedById: user.id,
        status: pending ? "PENDING" : "APPROVED",
        approvedById: pending ? null : user.id,
        decidedAt: pending ? null : now,
      },
    });
    await logActivity(tx, {
      actor: user.id,
      entity: "DeadlineChange",
      entityId: change.id,
      action: "CREATE",
      after: { ticketId: ticket.id, from: change.from, to: change.to, reason: change.reason, status: change.status },
    });
    if (pending) {
      await recordTicketEvent(tx, {
        ticketId: ticket.id,
        actor: user.id,
        type: "DEADLINE_REQUESTED",
        field: "dueDate",
        from: change.from,
        to: change.to,
        reason: change.reason,
      });
      return change;
    }
    await applyChange(tx, user.id, ticket, change);
    return change;
  });
}

/**
 * Approves or rejects a pending deadline change. HOD (own dept), CEO_OFFICE or CEO only.
 * Approval applies the new due date; the decider is recorded as `approvedById`.
 */
export async function decideDeadline(user: AuthzUser, ticketId: string, input: unknown) {
  const data = decideDeadlineSchema.parse(input);
  const { ticket, resource } = await loadTicket(user, ticketId);
  if (!canDecideDeadline(user, resource)) throw new ForbiddenError("ticket.changeDeadline");
  const change = await prisma.deadlineChange.findFirst({ where: { id: data.changeId, ticketId: ticket.id } });
  if (!change) throw new TicketInputError("changeId", "Unknown deadline change");

  return prisma.$transaction(async (tx) => {
    const status = data.approve ? "APPROVED" : "REJECTED";
    // Only decide once, even if two approvers click at the same time.
    const { count } = await tx.deadlineChange.updateMany({
      where: { id: change.id, status: "PENDING" },
      data: { status, approvedById: user.id, decidedAt: new Date() },
    });
    if (count === 0) throw new TicketInputError("changeId", "This deadline change was already decided");
    await logActivity(tx, {
      actor: user.id,
      entity: "DeadlineChange",
      entityId: change.id,
      action: "UPDATE",
      before: { status: change.status, approvedById: null },
      after: { status, approvedById: user.id },
    });
    if (data.approve) return applyChange(tx, user.id, ticket, change);
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "DEADLINE_REJECTED",
      field: "dueDate",
      from: change.from,
      to: change.to,
      reason: change.reason,
    });
    return ticket;
  });
}
