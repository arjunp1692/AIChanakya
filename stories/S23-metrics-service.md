# S23 — Metrics calculation service
model: opus · deps: S13, S16, S17, S22 · PRD: §6 metrics + reporting integrity · PLAN §5

## Goal
Correct, reconcilable numbers. Every metric is computed from ticket records and can return its ticket IDs.

## Scope
- `src/server/metrics/index.ts` `computeMetrics({from, to, deptId?, user})` returning, for each metric, `{ value, ticketIds }`:
  - assigned (cohort = created in period, excl. cancelled/duplicate), completedInPeriod, completedPctOfCohort, pendingPctOfCohort, carriedForward, delayed (open & effective due < now — derived from DeadlineChange/TicketEvent history, never self-reported labels), onTimeCompletionPct (completed ≤ due date applicable at completion), criticalIssues (open CRITICAL or open level-3 escalations), repeatedDelays (PLAN §5 rule), decisionsPending, reportingCompliance (S16).
  - Department breakdown: workload (open + created), on-time %, overdue rate, compliance %, plus a **weighted** score using priority weights (Setting `metrics.priorityWeights`, default C4/H3/M2/L1) so comparisons account for workload (PRD §6).
- Reopened/cancelled/duplicate rules exactly as PLAN §5; document them in a header comment.
- Respect `ticketVisibilityWhere(user)`.
- `scripts/reconcile.ts` (`pnpm reconcile`): recomputes each metric with independent raw SQL and diffs.

## Acceptance criteria
1. `pnpm reconcile` reports zero diffs on seed data for this week, last week, this month, per dept and all.
2. Completed% + Pending% of cohort = 100% (± rounding).
3. Every metric returns the ticketIds that make up its value.

## Validation
- `pnpm reconcile`; tsx printing metrics for one dept with ticket ID lists; spot-check 2 tickets manually.

## Implementation notes
_(implementer fills, ≤6 lines)_
