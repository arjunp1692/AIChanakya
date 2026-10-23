# S38 — Success KPI tracking
model: sonnet · deps: S26 · PRD: §14, §13 Phase 3 (validate metrics)

## Goal
The PRD §14 KPIs are measured every week, so targets can be checked against a baseline instead of a one-off number.

## Scope
- `src/server/metrics/kpis.ts` `computeKpis({from, to})`, each returning `{ value, target, ticketIds? }`:
  - Daily HoD reporting compliance % (S16) — target ≥ 95%.
  - Active tickets with a primary owner % — 100%.
  - Tickets with dueDate or noDeadlineReason % — 100%.
  - Weekly snapshot generated for each completed week since launch — 100%.
  - Material updates recorded %: report rows that produced a TicketEvent ÷ all linked report rows — ≥ 95%.
  - Critical escalations captured %: CRITICAL tickets that became BLOCKED or overdue in the period and have an Escalation ÷ all such tickets — 100%.
  - Duplicate tickets marked in period (count and % of created) — monitor.
  - Overdue open tickets at period end vs baseline — target −25% over 90 days.
  - Median report `fillSeconds` vs baseline (proxy for manual reporting time) — target −50%. An optional manual pre-launch baseline (hours per week) can be set in Settings.
- Targets in Setting `kpi.targets` (defaults above); baseline = first `kpi.baselineWeeks` (4) snapshot weeks after launch.
- S26 weekly snapshot also stores `kpis` in its metrics JSON; historic weeks are read from snapshots, the current week is live.
- `/reports/kpis` (CEO, CEO_OFFICE, VIEWER): weeks × KPIs table, target, baseline, change vs baseline, met/not-met chip; drill-down where ticketIds exist.
- Extend `pnpm reconcile` (S23) with independent SQL for each KPI.

## Acceptance criteria
1. `pnpm reconcile` shows zero KPI diffs on seed data.
2. `/reports/kpis` shows value, target, baseline and met/not-met for every §14 KPI.
3. Weekly snapshot JSON contains `kpis`; editing tickets later doesn't change past weeks.
4. MEMBER and HOD get forbidden.

## Validation
- `pnpm reconcile`; `pnpm worker -- --run-once weekly-snapshot --force` and inspect `metrics.kpis`; GET `/reports/kpis` as ceo@ (200) and edt.m1@ (forbidden).

## Implementation notes
_(implementer fills, ≤6 lines)_
