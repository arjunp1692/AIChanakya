# S20 — Scheduler and escalation engine
model: opus · deps: S19, S16 · PRD: FR-05, §7 (Critical = immediate escalation), §9 escalation policy, §15 (late reports)

## Goal
The PRD §9 escalation policy runs automatically, with configurable thresholds.

## Scope
- `worker/index.ts` with pg-boss; jobs scheduled in IST:
  - `deadline-approaching` (hourly): due within Setting `escalation.approachingHours` (24) → notify owner + co-assignees (once per ticket per window).
  - `deadline-missed` (hourly): newly overdue → Escalation(trigger=DEADLINE_MISSED, level 1) + notify owner & HOD.
  - `repeated-delay` (daily): extensionCount ≥ N or ≥ N overdue episodes (Setting `escalation.repeatThreshold`, 2) → Escalation level 2 + notify CEO_OFFICE.
  - `report-reminder` (daily at cut-off − Setting `report.reminderBeforeMinutes`, 60): HOD of each active dept with no report yet → reminder notification only, no escalation.
  - `missed-report` (daily at cut-off + 30m): dept without report → remind HOD + Escalation(MISSED_REPORT).
  - `decision-due` (hourly): PENDING decisions due within Setting `decision.reminderHours` (24) → notify CEO (once per decision); past `decisionDeadline` → Escalation(DECISION_OVERDUE, level 2, decisionId) + notify CEO & CEO_OFFICE.
- Event-driven (in services, not cron):
  - ticket set BLOCKED with CRITICAL priority → immediate Escalation(CRITICAL_BLOCKER, level 3) + notify CEO & CEO_OFFICE.
  - ticket set BLOCKED at any other priority → notify owner's HOD (and co-assignees), no escalation (FR-05 "blocked tasks").
  - daily report submitted with highestPriority CRITICAL → Escalation(REPORT_CRITICAL, level 3, departmentId, impact = blockersText, requiredAction "CEO review of department blocker") + notify CEO & CEO_OFFICE (PRD §7). Hook into S15 `submitDailyReport`; a resubmission of the same dept+date does not escalate again.
- `src/server/escalations/engine.ts` pure functions `evaluate(now, data)` → actions, so jobs are thin; every Escalation has ticket, owner, impact, requiredAction, createdAt (FR-05 acceptance).
- `pnpm worker -- --run-once <job>` flag for validation.

## Acceptance criteria
1. Each job creates escalations/notifications only for qualifying records and is idempotent on re-run.
2. Every escalation row has ticket (or dept for missed/critical report, or decision for overdue decision), owner (HOD for dept-level, requester for decisions), impact, requiredAction, timestamp.
3. Critical blocker escalates immediately on status change; a non-critical block notifies the HOD without creating an escalation.
4. Thresholds read from Settings (changing a Setting changes behaviour without code change).
5. A report submitted with highest priority Critical creates one REPORT_CRITICAL escalation and notifies the CEO.
6. A pending decision past its deadline creates one DECISION_OVERDUE escalation; `report-reminder` notifies only HODs of departments that haven't submitted yet.

## Validation
- Run each job with `--run-once` twice against seed; count Escalation rows (same after second run). Block a CRITICAL ticket via service; check escalation + CEO notification. Block a LOW ticket → HOD notification, no escalation. Submit a Critical report via service → one REPORT_CRITICAL. Back-date a seeded decision deadline and run `decision-due` twice → one DECISION_OVERDUE.

## Implementation notes
_(implementer fills, ≤6 lines)_
