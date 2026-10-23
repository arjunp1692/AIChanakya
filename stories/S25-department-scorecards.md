# S25 — Department scorecards and delay views
model: sonnet · deps: S24 · PRD: §6 department performance, §13 Phase 3, §10 Delay Pattern (facts only)

## Goal
A per-department scorecard plus a factual (non-AI) view of delays.

## Scope
- `/departments/[code]`: scorecard (workload, on-time %, overdue rate, compliance %, weighted score, trend over last 6 weeks from WeeklySnapshot or live compute), open critical tickets, top delayed tickets, owners with most overdue (counts only, no blame text).
- `/reports/delays`: tickets with repeated slippage (extensions, overdue episodes, reopen count) and current delay days; filter by dept/owner/priority. All rows link to tickets.
- HOD sees own dept only; CEO/CEO_OFFICE/VIEWER all.

## Acceptance criteria
1. Scorecard numbers equal the dept breakdown from `computeMetrics` for the same period.
2. Delays view lists every seeded ticket with extensionCount ≥ 2.
3. hod.edt@ cannot open `/departments/mkt`.

## Validation
- tsx compare scorecard values vs computeMetrics; GET pages as different roles.

## Implementation notes
_(implementer fills, ≤6 lines)_
