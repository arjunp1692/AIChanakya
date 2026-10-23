# S37 — Inconsistent update detection
model: sonnet · deps: S30, S29 · PRD: FR-07 (flag inconsistent updates), §15 (updates without meaningful content)

## Goal
Catch updates that contradict each other or the ticket record before they mislead the dashboard. Rules are deterministic, so this works without an AI key.

## Scope
- `src/server/intel/consistency.ts` `findInconsistencies({deptId?, ticketIds?, now})` → `[{rule, ticketNo, detail}]`. Rules (thresholds from Settings `consistency.*`):
  - `PROGRESS_DONE_OPEN`: progress 100 but status is not COMPLETED / AWAITING_APPROVAL for ≥ 1 working day.
  - `PROGRESS_DROPPED`: progress lower than the previous update with no reason or comment.
  - `REPORTED_DONE_NOT_DONE`: latest report has the row in "Completed today", but the ticket is neither COMPLETED nor AWAITING_APPROVAL.
  - `SELF_LABEL_MISMATCH`: ticket is overdue by dates but was reported under In progress / Completed, not Delayed (PRD §6: dates win over labels).
  - `STALE_UPDATE`: ticket reported in ≥ `consistency.staleReports` (3) consecutive reports with no status/progress change and no new comment.
  - `CONTRIBUTIONS_DONE_TICKET_IDLE`: every co-assignee contribution is DONE but the ticket status hasn't changed for ≥ `consistency.idleDays` (3).
  - `BLOCKED_NO_CAUSE`: BLOCKED with no unresolved dependency and the blocker reason unchanged for ≥ `consistency.idleDays`.
- After `submitDailyReport` (S15): run the rules on the report's tickets; the confirmation page shows a warning per flagged row; the HOD gets **one** consolidated notification per report (S19). Warnings never block submission.
- `/intel` (S30): "Inconsistent updates" section grouped by rule and dept; every row links to its ticket.
- Daily brief (S29): flagged items are added to the deterministic facts list (count + ticketNos).
- Results are computed live and not stored as AI output; this is system fact, so it is shown without the "AI-generated" badge.

## Acceptance criteria
1. A script-created ticket for each rule is flagged with the right rule; clean seeded tickets are not flagged.
2. Report confirmation shows row warnings, and the HOD receives exactly one notification for that report.
3. `/intel` and the daily brief list inconsistencies with ticket links, with no API key set.
4. Changing a `consistency.*` Setting changes the result without restart.

## Validation
- tsx script: create one ticket per rule via services, run `findInconsistencies`, assert rules; submit a report via service and count Notification rows; GET `/intel` as ceo@ and grep "Inconsistent updates".

## Implementation notes
_(implementer fills, ≤6 lines)_
