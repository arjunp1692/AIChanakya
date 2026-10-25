import type { Prisma } from "@prisma/client";
import { createTicketSchema } from "@/lib/schemas/ticket";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
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
