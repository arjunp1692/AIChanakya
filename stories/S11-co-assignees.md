# S11 — Co-assignees and contributions
model: sonnet · deps: S09 · PRD: FR-03, §3 accountability rule

## Goal
Multiple people across departments can contribute while ownership stays unambiguous.

## Scope
- Add/remove co-assignees (any department) with a `responsibility` text — ticket.assign permission.
- Owner cannot also be a co-assignee; exactly one owner always.
- Co-assignee updates own `contributionStatus` (NOT_STARTED|IN_PROGRESS|DONE|BLOCKED), own progress and note → TicketEvent(CONTRIBUTION). They cannot change ticket status, owner, deadline or others' contributions.
- Co-assigned tickets appear in the co-assignee's ticket list (`assignee` filter) and stay visible to the originating dept and CEO.
- Ticket page: contributions table.

## Acceptance criteria
1. Cross-dept co-assignee can update only their own contribution (403 for others' rows and ticket status).
2. Adding the owner as co-assignee rejected.
3. Contribution updates appear in history.

## Validation
- Using a seeded cross-dept ticket: log in as the co-assignee, update own contribution (OK), attempt status change (403), attempt another contributor's row (403).

## Implementation notes
- `src/server/tickets/assignees.ts`: `addAssignee`/`removeAssignee` (need `ticket.assign`; add only on open tickets, any dept, owner/duplicate → 400) and `updateContribution` (needs `ticket.contribute` **and** row.userId === caller, else 403; DONE forces progress 100). Each = TicketEvent + ActivityLog (`entity: "TicketAssignee"`) in one tx.
- Events: `ASSIGNEE_ADDED`/`ASSIGNEE_REMOVED` (field `assignee`, user id; responsibility in `reason`), `CONTRIBUTION` (field `contribution`, from/to JSON `{status,progress}`, note in `reason`).
- Migration `contributions`: `ContributionStatus.BLOCKED`, `TicketAssignee.note`. `updateTicket` now rejects making a co-assignee the owner (400).
- UI: Contributions card (table + `AddAssigneeForm`, `RemoveAssigneeButton`, own `ContributionForm`) in ticket page main column; replaced sidebar co-assignee list. Constants `CONTRIBUTION_STATUSES/LABELS/BADGE`.
- Check: `pnpm exec tsx .harness/tmp/s11-check.ts` (mutates seeded KN-EDT-2026-00001). `db:reset` is blocked for agents by Prisma; the migration was applied with `migrate dev`.
- Follow-ups: co-assignee contributions don't roll up into ticket progress; removed co-assignee keeps no history row of their contribution beyond events.
