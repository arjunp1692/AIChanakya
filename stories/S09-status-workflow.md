# S09 — Status workflow state machine
model: opus · deps: S08 · PRD: §9, FR-04

## Goal
Status changes follow the defined lifecycle and stay fully traceable.

## Scope
- `src/server/tickets/workflow.ts`: transition map
  - NEW→ASSIGNED|IN_PROGRESS|CANCELLED; ASSIGNED→IN_PROGRESS|ON_HOLD|CANCELLED; IN_PROGRESS→BLOCKED|AWAITING_APPROVAL|ON_HOLD|COMPLETED|CANCELLED; BLOCKED→IN_PROGRESS|ON_HOLD|CANCELLED; AWAITING_APPROVAL→IN_PROGRESS|COMPLETED; ON_HOLD→IN_PROGRESS|CANCELLED; COMPLETED→IN_PROGRESS (reopen, HOD+ only, reason required, reopenCount++).
- BLOCKED requires `blockerReason`; CANCELLED requires reason; progress update (0–100) allowed in open statuses.
- COMPLETED sets `completedAt`; evidence/validation rules are added in S13 — leave a hook.
- `isOverdue(ticket, now)` in `src/lib/ticket-utils.ts` (open status && dueDate < now) — single source used everywhere.
- UI: status dropdown showing only allowed next states + reason dialog; progress slider.

## Acceptance criteria
1. Illegal transitions are rejected server-side (e.g. NEW→COMPLETED).
2. BLOCKED without reason rejected; with reason stored on ticket and in history.
3. Reopen requires HOD/CEO_OFFICE/CEO and a reason; increments reopenCount; clears completedAt into history.
4. Overdue never stored as status.

## Validation
- tsx script calling the service for each legal/illegal transition and printing results; DB check of events.

## Implementation notes
_(implementer fills, ≤6 lines)_
