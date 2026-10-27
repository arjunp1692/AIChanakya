# S10 — Deadline changes with reason and approval
model: sonnet · deps: S09 · PRD: §9 (Deadline extended), §15, FR-08

## Goal
Deadlines can move, but the original is never lost and every change is justified.

## Scope
- `changeDeadline(user, ticketId, newDate, reason)`: reason mandatory; writes DeadlineChange + TicketEvent; `originalDueDate` untouched; `extensionCount++` when moved later.
- Approval policy (Setting `deadline.approval`): owner/member changes create a pending DeadlineChange needing HOD approval; HOD/CEO_OFFICE/CEO changes are auto-approved with approver = self. Ticket dueDate updates only on approval.
- UI on ticket page: "Change deadline" dialog; pending-approval banner; HOD sees approve/reject.
- Ticket page shows original vs current due date and extension count.

## Acceptance criteria
1. Change without reason rejected.
2. originalDueDate unchanged after any number of changes.
3. Member's change stays pending until HOD approves; approver recorded.
4. extensionCount accurate.

## Validation
- tsx/curl: edt.m1@ requests extension → pending; hod.edt@ approves → dueDate updated; check DeadlineChange + originalDueDate.

## Implementation notes
- `src/server/tickets/deadline.ts`: `changeDeadline(user, id, {dueDate, reason})`, `decideDeadline(user, id, {changeId, approve})`, `canDecideDeadline`, `deadlineNeedsApproval`. Open tickets only; future dates only; one PENDING per ticket.
- Schema: `DeadlineChange.status` (PENDING/APPROVED/REJECTED, default APPROVED) + `decidedAt`; `approvedById` = decider (self when auto). Setting `deadline.approval`: `"HOD"` (members wait) | `"NONE"`.
- Approval applies via `updateMany where dueDate = change.from` (stale → 400). `originalDueDate` only set if null (first deadline); `extensionCount++` only when moved later; clears `noDeadlineReason`.
- Events: `DEADLINE_REQUESTED`, `DEADLINE_CHANGED`, `DEADLINE_REJECTED` (field `dueDate`, reason). ActivityLog: `DeadlineChange` CREATE/UPDATE + `Ticket` UPDATE on apply.
- UI: `DeadlineControl` (dialog) + `DeadlineDecision` (approve/reject) in `ticket-forms.tsx`; amber `PENDING_BANNER` token in constants. Check: `pnpm exec tsx .harness/tmp/s10-check.ts`.
- Follow-ups: notify HOD of pending requests (S19); pending requests on closed tickets are left as-is.
