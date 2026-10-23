# S16 — Carry-forward and reporting compliance
model: sonnet · deps: S15 · PRD: FR-02 acceptance, §9 (Daily report not submitted), §14 KPI

## Goal
Unfinished work rolls into the next report automatically, and missing submissions become visible.

## Scope
- When opening the form for date D, pre-populate linked rows for all open dept tickets (owner or co-assignee in dept) not completed/cancelled, with original due dates and history intact; overdue rows pre-placed in "Delayed".
- `src/server/reports/compliance.ts`: `missingReports(fromDate, toDate)` (working days Mon–Sat, configurable via Setting `report.workingDays`) and `complianceRate(dept, period)`; on-time = submittedAt ≤ cut-off (Setting `report.cutoff`, default 19:00 IST).
- `/reports/compliance` (CEO, CEO_OFFICE, VIEWER; HOD sees own dept): grid dept × day (on time / late / missing) + rate.

## Acceptance criteria
1. Form for a new date contains all open dept tickets without changing their dueDate/originalDueDate.
2. Seeded missing days show as missing; compliance % matches manual count.
3. Late submission (after cut-off) shown as late, not missing.

## Validation
- tsx: compute missingReports for seed window and compare with a direct query; GET compliance page as ceo@ and grep a known missing cell.

## Implementation notes
_(implementer fills, ≤6 lines)_
