import type { Prisma } from "@prisma/client";
import { addCommentSchema, createTicketSchema, updateTicketSchema } from "@/lib/schemas/ticket";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { resourceInclude, toTicketResource } from "./detail";
import { nextTicketNo } from "./id";

/** Input that passed the schema but fails a data rule (unknown department, owner outside it). */
export class TicketInputError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = "TicketInputError";
  }
}

/** Department codes whose new tickets default to confidential (Setting, default `["HR"]`). */
export async function confidentialDefaultDepts(): Promise<string[]> {
  const row = await prisma.setting.findUnique({ where: { key: "confidential.defaultDepts" } });
  return Array.isArray(row?.value) ? row.value.filter((v): v is string => typeof v === "string") : ["HR"];
}

/**
 * Creates a ticket valid from birth: owner + deadline (or no-deadline reason) enforced,
 * `originalDueDate` set once, CREATED event and activity log in the same transaction.
 * Throws ZodError, TicketInputError or ForbiddenError.
 */
export async function createTicket(user: AuthzUser, input: unknown) {
  const data = createTicketSchema.parse(input);

  const dept = await prisma.department.findFirst({ where: { id: data.departmentId, active: true } });
  if (!dept) throw new TicketInputError("departmentId", "Unknown department");
  const confidential = data.confidential ?? (await confidentialDefaultDepts()).includes(dept.code);
  // Authorise before checking the owner so a forbidden department is a 403, not a validation error.
  assertCan(user, "ticket.create", { departmentId: dept.id, ownerId: data.ownerId, confidential });

  const owner = await prisma.user.findFirst({
    where: { id: data.ownerId, active: true, departmentId: dept.id },
  });
  if (!owner) throw new TicketInputError("ownerId", "Owner must be an active member of the department");

  return prisma.$transaction(async (tx) => {
    const ticketNo = await nextTicketNo(tx, dept.code);
    const created: Prisma.TicketUncheckedCreateInput = {
      ticketNo,
      title: data.title,
      description: data.description,
      departmentId: dept.id,
      ownerId: owner.id,
      priority: data.priority,
      status: owner.id === user.id ? "NEW" : "ASSIGNED",
      dueDate: data.dueDate ?? null,
      originalDueDate: data.dueDate ?? null,
      noDeadlineReason: data.dueDate ? null : (data.noDeadlineReason ?? null),
      confidential,
      createdById: user.id,
    };
    const ticket = await tx.ticket.create({ data: created });

    await recordTicketEvent(tx, { ticketId: ticket.id, actor: user.id, type: "CREATED", to: ticket.status });
    await logActivity(tx, {
      actor: user.id,
      entity: "Ticket",
      entityId: ticket.id,
      action: "CREATE",
      before: null,
      after: ticket,
    });
    return ticket;
  });
}

/** Fields editable via `updateTicket`; each change becomes its own FIELD_CHANGED event. */
const EDITABLE_FIELDS = ["title", "description", "priority", "ownerId"] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

/**
 * Edits title/description/priority/owner. Needs `ticket.edit`; an owner change also needs
 * `ticket.assign`, a reason, and a new owner who is an active member of the ticket's department.
 * Unchanged input writes nothing. Throws ZodError, TicketInputError or ForbiddenError.
 */
export async function updateTicket(user: AuthzUser, ticketId: string, input: unknown) {
  const data = updateTicketSchema.parse(input);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  const resource = toTicketResource(ticket);
  assertCan(user, "ticket.edit", resource);

  const fields = EDITABLE_FIELDS.filter((f) => data[f] !== undefined && data[f] !== ticket[f]);
  if (fields.includes("ownerId")) {
    assertCan(user, "ticket.assign", resource);
    if (!data.ownerReason) throw new TicketInputError("ownerReason", "Give a reason for changing the owner");
    const owner = await prisma.user.findFirst({
      where: { id: data.ownerId, active: true, departmentId: ticket.departmentId },
    });
    if (!owner) throw new TicketInputError("ownerId", "Owner must be an active member of the department");
  }
  if (fields.length === 0) return ticket;

  const pick = (t: Partial<Record<EditableField, unknown>>) => Object.fromEntries(fields.map((f) => [f, t[f]]));
  return prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: ticket.id }, data: pick(data) });
    for (const field of fields) {
      await recordTicketEvent(tx, {
        ticketId: ticket.id,
        actor: user.id,
        type: "FIELD_CHANGED",
        field,
        from: ticket[field],
        to: updated[field],
        reason: field === "ownerId" ? data.ownerReason : undefined,
      });
    }
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

/** Adds a comment (`ticket.comment`): Comment + COMMENT event + ActivityLog in one transaction. */
export async function addComment(user: AuthzUser, ticketId: string, input: unknown) {
  const data = addCommentSchema.parse(input);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  assertCan(user, "ticket.comment", toTicketResource(ticket));

  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({ data: { ticketId, authorId: user.id, body: data.body } });
    await recordTicketEvent(tx, { ticketId, actor: user.id, type: "COMMENT", to: comment.id });
    await logActivity(tx, {
      actor: user.id,
      entity: "Comment",
      entityId: comment.id,
      action: "CREATE",
      before: null,
      after: comment,
    });
    return comment;
  });
}
