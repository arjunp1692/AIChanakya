# S30 — Delay patterns and cross-department bottlenecks
model: opus · deps: S28, S12, S25 · PRD: §10 Delay Pattern Detection, Cross-Department Intelligence

## Goal
Surface patterns, keeping evidence separate from hypotheses.

## Scope
- Deterministic detectors (`src/server/intel/`):
  - Repeated delays grouped by owner, department, dependency target, and keyword clusters of titles (pg_trgm).
  - Bottlenecks: from `getDependencyGraph` — open tickets with ≥2 dependents from ≥2 departments, or one approval/decision blocking several tickets; inter-dept waiting matrix (dept A waiting on dept B count).
- AI step: give detector output to Claude to phrase insights + suggested action; detector results become `facts` (confidence "pattern"), model speculation is `hypothesis`.
- `/intel` page (CEO, CEO_OFFICE): waiting matrix heatmap, bottleneck list, delay patterns, AI cards. Weekly job + "Refresh" button.

## Acceptance criteria
1. Seeded cross-dept dependency cluster appears as a bottleneck with all linked ticketNos.
2. Detector results show without AI key; AI text labelled as hypothesis where applicable.
3. No owner-level blame text appears without a supporting ticket list.

## Validation
- tsx running detectors on seed and printing results; GET `/intel` as ceo@ and hod.edt@ (forbidden).

## Implementation notes
_(implementer fills, ≤6 lines)_
