import { markDuplicateSchema } from "@/lib/schemas/ticket";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, can, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { resourceInclude, toTicketResource } from "./detail";
import { TicketInputError } from "./service";
import { changeStatus } from "./workflow";

/**
 * Marks a ticket as a duplicate of another (`ticket.markDuplicate`): cancels it through the normal
 * lifecycle and sets `duplicateOfId`, with a DUPLICATE_MARKED event and ActivityLog in one
 * transaction. The original must be visible and not cancelled, which also rules out chains and cycles.
 * Throws ZodError, TicketInputError or ForbiddenError.
 */
export async function markDuplicate(user: AuthzUser, ticketId: string, input: unknown) {
  const data = markDuplicateSchema.parse(input);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  assertCan(user, "ticket.markDuplicate", toTicketResource(ticket));

  const original = await prisma.ticket.findUnique({
    where: { ticketNo: data.duplicateOf.toUpperCase() },
    include: resourceInclude,
  });
  if (!original || !can(user, "ticket.view", toTicketResource(original))) {
    throw new TicketInputError("duplicateOf", "Unknown ticket ID");
  }
  if (original.id === ticket.id) throw new TicketInputError("duplicateOf", "A ticket cannot duplicate itself");
  if (original.status === "CANCELLED") {
    throw new TicketInputError("duplicateOf", "That ticket is cancelled; choose the ticket that stays open");
  }

  const reason = [`Duplicate of ${original.ticketNo}`, data.reason].filter(Boolean).join(": ");
  return prisma.$transaction(async (tx) => {
    await changeStatus(user, ticket.id, { status: "CANCELLED", reason }, { tx });
    const updated = await tx.ticket.update({ where: { id: ticket.id }, data: { duplicateOfId: original.id } });
    await recordTicketEvent(tx, {
      ticketId: ticket.id,
      actor: user.id,
      type: "DUPLICATE_MARKED",
      field: "duplicateOf",
      to: original.ticketNo,
    });
    await logActivity(tx, {
      actor: user.id,
      entity: "Ticket",
      entityId: ticket.id,
      action: "UPDATE",
      before: { duplicateOfId: ticket.duplicateOfId },
      after: { duplicateOfId: updated.duplicateOfId },
    });
    return updated;
  });
}
