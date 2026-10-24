/**
 * Central permission policy. Every service checks `can`/`assertCan`; every ticket query is
 * scoped with `ticketVisibilityWhere`. Role and department always come from the session.
 *
 * Rules matrix ("own" = the user's departmentId; "assigned" = owner or co-assignee):
 *
 * | Action                   | CEO | CEO_OFFICE | VIEWER          | HOD                         | MEMBER                     |
 * |--------------------------|-----|------------|-----------------|-----------------------------|----------------------------|
 * | ticket.view              | all | all        | non-confidential| own dept, assigned, linked¹ | own dept, assigned         |
 * | ticket.create            | yes | yes        | —               | own dept                    | —                          |
 * | ticket.edit              | yes | yes        | —               | own dept                    | tickets they own           |
 * | ticket.changeStatus      | yes | yes        | —               | own dept                    | tickets they own           |
 * | ticket.changeDeadline    | yes | yes        | —               | own dept                    | tickets they own (request) |
 * | ticket.assign / validate | yes | yes        | —               | own dept                    | —                          |
 * | ticket.comment           | yes | yes        | —               | any visible ticket          | any visible ticket         |
 * | ticket.contribute        | yes | yes        | —               | own co-assignment           | own co-assignment          |
 * | report.submit            | yes | yes        | —               | own dept                    | —                          |
 * | report.view              | yes | yes        | yes             | own dept                    | —                          |
 * | decision.request         | yes | yes        | —               | yes                         | —                          |
 * | decision.decide          | yes | —          | —               | —                           | —                          |
 * | escalation.view          | yes | yes        | yes             | own dept                    | —                          |
 * | escalation.resolve       | yes | yes        | —               | own dept                    | —                          |
 * | settings.manage          | yes | yes        | —               | —                           | —                          |
 * | admin.users / departments| yes | yes        | —               | —                           | —                          |
 * | ai.review                | yes | yes        | —               | —                           | —                          |
 * | dashboard.ceo            | yes | yes        | yes (read)      | —                           | —                          |
 *
 * ¹ linked = non-confidential tickets that depend on, or are depended on by, an own-dept ticket.
 * Confidential tickets: visible only to owner, co-assignees, the department's HOD, CEO and CEO_OFFICE.
 * Ticket actions other than view require view. Without a resource, `can` answers
 * "could this role ever do this?" (used for navigation and buttons).
 */
import type { Prisma, Role } from "@prisma/client";

export type AuthzUser = { id: string; role: Role; departmentId: string | null };

export type Action =
  | "ticket.view"
  | "ticket.create"
  | "ticket.edit"
  | "ticket.assign"
  | "ticket.changeStatus"
  | "ticket.changeDeadline"
  | "ticket.validate"
  | "ticket.comment"
  | "ticket.contribute"
  | "report.submit"
  | "report.view"
  | "decision.request"
  | "decision.decide"
  | "escalation.view"
  | "escalation.resolve"
  | "settings.manage"
  | "admin.users"
  | "admin.departments"
  | "ai.review"
  | "dashboard.ceo";

export type TicketResource = {
  departmentId: string;
  ownerId: string;
  confidential: boolean;
  /** Co-assignee user IDs. */
  assigneeIds?: string[];
  /** Departments of tickets linked to this one by a dependency (either direction). */
  linkedDepartmentIds?: string[];
};

/** Any department-scoped resource (report, escalation, decision). */
export type DeptResource = { departmentId: string | null };

export type Resource = TicketResource | DeptResource;

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

const isTicket = (r: Resource | undefined): r is TicketResource => !!r && "ownerId" in r;

function canViewTicket(user: AuthzUser, t: TicketResource): boolean {
  const ownDept = !!user.departmentId && t.departmentId === user.departmentId;
  const assigned = t.ownerId === user.id || !!t.assigneeIds?.includes(user.id);
  switch (user.role) {
    case "CEO":
    case "CEO_OFFICE":
      return true;
    case "VIEWER":
      return !t.confidential;
    case "HOD": {
      if (ownDept || assigned) return true;
      const linked = !!user.departmentId && !!t.linkedDepartmentIds?.includes(user.departmentId);
      return linked && !t.confidential;
    }
    case "MEMBER":
      return assigned || (ownDept && !t.confidential);
  }
}

function ticketAction(user: AuthzUser, action: Action, t: TicketResource | undefined): boolean {
  if (t && !canViewTicket(user, t)) return false;
  if (action === "ticket.view") return true;
  if (user.role === "VIEWER") return false;

  const ownDept = !t || (!!user.departmentId && t.departmentId === user.departmentId);
  const owns = !t || t.ownerId === user.id;
  const coAssigned = !t || !!t.assigneeIds?.includes(user.id);

  switch (action) {
    case "ticket.comment":
      return true;
    case "ticket.contribute":
      return coAssigned;
    case "ticket.create":
    case "ticket.assign":
    case "ticket.validate":
      return user.role === "HOD" && ownDept;
    case "ticket.edit":
    case "ticket.changeStatus":
    case "ticket.changeDeadline":
      return (user.role === "HOD" && ownDept) || (user.role === "MEMBER" && owns);
    default:
      return false;
  }
}

export function can(user: AuthzUser, action: Action, resource?: Resource): boolean {
  if (user.role === "CEO") return true;
  if (user.role === "CEO_OFFICE") return action !== "decision.decide";

  if (action.startsWith("ticket.")) {
    return ticketAction(user, action, isTicket(resource) ? resource : undefined);
  }

  const ownDept = !resource || (!!user.departmentId && resource.departmentId === user.departmentId);
  switch (action) {
    case "report.view":
    case "escalation.view":
      return user.role === "VIEWER" || (user.role === "HOD" && ownDept);
    case "report.submit":
    case "escalation.resolve":
      return user.role === "HOD" && ownDept;
    case "decision.request":
      return user.role === "HOD";
    case "dashboard.ceo":
      return user.role === "VIEWER";
    default:
      return false;
  }
}

export function assertCan(user: AuthzUser, action: Action, resource?: Resource): void {
  if (!can(user, action, resource)) throw new ForbiddenError(action);
}

/** Prisma filter restricting tickets to those `user` may view (mirrors `canViewTicket`). */
export function ticketVisibilityWhere(user: AuthzUser): Prisma.TicketWhereInput {
  const assigned: Prisma.TicketWhereInput[] = [
    { ownerId: user.id },
    { assignees: { some: { userId: user.id } } },
  ];
  const dept = user.departmentId;

  switch (user.role) {
    case "CEO":
    case "CEO_OFFICE":
      return {};
    case "VIEWER":
      return { confidential: false };
    case "HOD":
      if (!dept) return { OR: assigned };
      return {
        OR: [
          { departmentId: dept },
          ...assigned,
          { confidential: false, dependencies: { some: { dependsOnTicket: { departmentId: dept } } } },
          { confidential: false, dependents: { some: { ticket: { departmentId: dept } } } },
        ],
      };
    case "MEMBER":
      return {
        OR: dept ? [{ departmentId: dept, confidential: false }, ...assigned] : assigned,
      };
  }
}
