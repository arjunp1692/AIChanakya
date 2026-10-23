# S26 — Automatic weekly report snapshot
model: sonnet · deps: S23, S20 · PRD: FR-06, §8 (separate records), §14 (weekly dashboard 100%)

## Goal
Each week's numbers are frozen automatically, so later edits can't rewrite history.

## Scope
- pg-boss job `weekly-snapshot` (Monday 06:00 IST): `computeMetrics` for the previous Mon–Sun, org-wide + per dept, as system user → `WeeklySnapshot` rows (incl. ticketId lists).
- `/reports/weekly`: list of snapshots; detail view renders the same KPI layout from the frozen JSON with a "Snapshot taken at …" note, plus a "Compare with live" toggle.
- Notify CEO + CEO_OFFICE when ready (S19).
- `--run-once weekly-snapshot` support; idempotent per period (re-run replaces only if `--force`).

## Acceptance criteria
1. Running the job creates org + one snapshot per active dept (9 on seed) for last week; re-run without force creates none.
2. Editing a ticket afterwards does not change the snapshot view.
3. CEO receives an in-app notification.

## Validation
- `pnpm worker -- --run-once weekly-snapshot` twice; count rows; edit a ticket; compare snapshot JSON before/after.

## Implementation notes
_(implementer fills, ≤6 lines)_
