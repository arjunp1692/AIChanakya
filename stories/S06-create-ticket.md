# S06 — Create ticket
model: sonnet · deps: S04, S05 · PRD: FR-01, §8

## Goal
Authorised users create tickets that are valid from birth.

## Scope
- `src/server/tickets/service.ts` `createTicket(user, input)`: Zod schema in `src/lib/schemas/ticket.ts`; `assertCan`; generates ticketNo; sets `originalDueDate = dueDate`; status `ASSIGNED` if owner ≠ creator else `NEW`; writes TicketEvent(CREATED) + ActivityLog in one transaction.
- Rules: owner required; dueDate required unless `noDeadlineReason` given; MEMBER may only create in own dept with self as owner; HOD in own dept; CEO/CEO_OFFICE any dept.
- UI `/tickets/new`: title, description, department, owner (user picker filtered by dept), priority, due date / "no deadline" + reason, confidential toggle. Redirect to ticket page on success.
- `confidential` defaults to true for departments in Setting `confidential.defaultDepts` (default `["HR"]`, PRD §11 Privacy); the creator can untick it.

## Acceptance criteria
1. A ticket cannot be saved without owner, or without dueDate/noDeadlineReason (server-side, not just UI).
2. Created ticket gets a unique `KN-<CODE>-<YYYY>-<n>` and `originalDueDate` set.
3. Creation appears in TicketEvent and ActivityLog.
4. MEMBER of EDT cannot create a ticket in MKT (403).
5. A ticket created in HR without an explicit `confidential` value is stored confidential.

## Validation
- Call the server action/route as hod.edt@ with and without owner; as edt.m1@ for MKT dept; query DB for event/log rows.

## Implementation notes
_(implementer fills, ≤6 lines)_
