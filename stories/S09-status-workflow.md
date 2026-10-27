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
- `src/server/tickets/workflow.ts`: `TRANSITIONS` map, `changeStatus(user, id, {status, reason})`, `updateProgress(user, id, {progress})`, `allowedNextStatuses`/`needsReason` for UI. Both need `ticket.changeStatus`; reopen (COMPLETED→IN_PROGRESS) also HOD/CEO_OFFICE/CEO. Errors → 400 `TicketInputError("status"|"reason"|"progress")`, 403 ForbiddenError.
- Events: `STATUS_CHANGED`/`REOPENED` (field `status`, reason on event) + reopen adds `FIELD_CHANGED completedAt → null`; `PROGRESS` (field `progress`). One ActivityLog `UPDATE` per call. Status update guarded by `updateMany where status = from` (concurrent change → 400).
- BLOCKED sets `blockerReason` (cleared when leaving BLOCKED); COMPLETED sets `completedAt` + progress 100; reopen clears `completedAt`, `reopenCount++`. **S13 hook:** `assertCanComplete(tx, ticket)` in workflow.ts (no-op now, runs in the tx).
- `isOverdue`/`isOpenStatus` now live in `src/lib/ticket-utils.ts` (query.ts keeps the SQL mirror `overdueWhere`).
- UI: `StatusControl` (dropdown + confirm/reason dialog) and `ProgressForm` (slider) in `ticket-forms.tsx`; history renders status/reopen/progress events. Check: `pnpm exec tsx .harness/tmp/s09-check.ts`.
- Follow-ups: AWAITING_APPROVAL→COMPLETED is not limited to approvers yet (S13 validation); reopen does not clear `validatedBy/At`.
