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
_(implementer fills, ≤6 lines)_
