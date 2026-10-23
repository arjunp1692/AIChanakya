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
_(implementer fills, ≤6 lines)_
