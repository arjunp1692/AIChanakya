import type { Prisma } from "@prisma/client";
import { isOverdue } from "@/lib/ticket-utils";
import { assertCan, type AuthzUser, type TicketResource } from "@/server/authz";
import { prisma } from "@/server/db";

/** Relations needed to build a `TicketResource` (co-assignees + linked departments). */
export const resourceInclude = {
  assignees: { select: { userId: true } },
  dependencies: { select: { dependsOnTicket: { select: { departmentId: true } } } },
  dependents: { select: { ticket: { select: { departmentId: true } } } },
} satisfies Prisma.TicketInclude;

type ResourceRow = Prisma.TicketGetPayload<{ include: typeof resourceInclude }>;

export function toTicketResource(t: ResourceRow): TicketResource {
  const linked = [
    ...t.dependencies.map((d) => d.dependsOnTicket?.departmentId),
    ...t.dependents.map((d) => d.ticket.departmentId),
  ].filter((id): id is string => !!id && id !== t.departmentId);
  return {
    departmentId: t.departmentId,
    ownerId: t.ownerId,
    confidential: t.confidential,
    assigneeIds: t.assignees.map((a) => a.userId),
    linkedDepartmentIds: [...new Set(linked)],
  };
}

const userName = { select: { id: true, name: true } } as const;

const detailInclude = {
  department: { select: { id: true, code: true, name: true } },
  owner: userName,
  createdBy: userName,
  validatedBy: userName,
  duplicateOf: { select: { ticketNo: true, title: true } },
  assignees: { include: { user: userName }, orderBy: { createdAt: "asc" } },
  dependencies: {
    include: { dependsOnTicket: { select: { ticketNo: true, title: true, status: true, departmentId: true } } },
  },
  dependents: { include: { ticket: { select: { ticketNo: true, title: true, status: true, departmentId: true } } } },
  attachments: { include: { uploadedBy: userName }, orderBy: { createdAt: "desc" } },
  comments: { include: { author: userName }, orderBy: { createdAt: "asc" } },
  events: { include: { actor: userName }, orderBy: { at: "desc" } },
  deadlineChanges: { where: { status: "PENDING" }, include: { requestedBy: userName }, orderBy: { at: "desc" } },
} satisfies Prisma.TicketInclude;

export type TicketDetail = Prisma.TicketGetPayload<{ include: typeof detailInclude }> & {
  overdue: boolean;
  resource: TicketResource;
};

/** Full ticket for the detail page. Null if it doesn't exist; throws ForbiddenError if not viewable. */
export async function getTicketDetail(user: AuthzUser, ticketNo: string): Promise<TicketDetail | null> {
  const ticket = await prisma.ticket.findUnique({ where: { ticketNo }, include: detailInclude });
  if (!ticket) return null;
  const resource = toTicketResource(ticket);
  assertCan(user, "ticket.view", resource);
  return { ...ticket, overdue: isOverdue(ticket), resource };
}
