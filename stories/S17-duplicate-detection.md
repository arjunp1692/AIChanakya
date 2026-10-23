# S17 — Duplicate ticket detection
model: sonnet · deps: S15 · PRD: §4, §15 (duplicate tickets), §14 KPI

## Goal
Stop the same task from becoming two tickets.

## Scope
- `findSimilarTickets(deptId, title)` using `pg_trgm` similarity ≥ 0.45 (Setting) over open tickets in same dept + tickets shared with dept.
- In the report form and `/tickets/new`: when a new title matches, show suggestions with "Link to existing" or "Create anyway" (requires confirmation checkbox; stored as TicketEvent flag `duplicateOverride`).
- HOD/CEO_OFFICE can mark a ticket as duplicate of another → status CANCELLED + `duplicateOfId`, excluded from metrics (PLAN §5).

## Acceptance criteria
1. A new row titled near-identically to an open ticket shows it as a suggestion.
2. Creating anyway without confirmation is rejected server-side.
3. Marking duplicate sets duplicateOfId and CANCELLED, logged in history.

## Validation
- tsx: call findSimilarTickets with a seeded title variant; submit report with override missing (rejected) and present (accepted).

## Implementation notes
_(implementer fills, ≤6 lines)_
