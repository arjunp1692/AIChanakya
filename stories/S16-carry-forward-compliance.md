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
- `src/lib/report-carry-forward.ts` `carryForwardRows` builds the rows client-side per date (overdue = past end of day D, IST). Status/progress/due date stay blank so an untouched row changes nothing; only BLOCKED rows pre-fill a reason, since a delay reason becomes a ticket comment. Dates with a submitted report start empty (use "Load submitted report"); saved drafts win over carry-forward and aren't merged with newer tickets.
- `deptTicketWhere` (`reports/form.ts`) = ticket's dept, or owner/co-assignee in dept; `submit.ts` uses it too, so cross-dept rows are accepted, but status/deadline edits on them still fail `can()`. Rows are filtered by visibility: an HOD doesn't get a cross-dept ticket they can't see.
- `src/server/reports/compliance.ts`: `missingReports`, `complianceRate` (no user, for S20/S23), `getComplianceGrid(user, period)`, `compliancePeriod` (max 31 days, default 14). Rate = on-time / expected, whole percent. Earliest revision decides on time/late. PENDING = today before cut-off, not counted.
- Settings: `report.workingDays` (ISO weekdays) added to seed, default Mon–Sat when unset; `report.cutoff.timezone` is ignored, all IST. Form rows capped at `REPORT_MAX_ROWS` (200), overdue first, with a notice.
- Check: `BASE_URL=… pnpm exec tsx .harness/tmp/s16-check.ts`. `pnpm build` shares `.next` with `pnpm dev`: stop dev first or it breaks (missing vendor-chunks) and needs a restart.
- Follow-ups: expected days ignore a department's start date (a new dept shows old days missing); no holiday calendar; S33 should edit `report.workingDays`.
