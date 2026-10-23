# S12 — Ticket dependencies
model: sonnet · deps: S09 · PRD: FR-03, §8, §10 Cross-Department Intelligence

## Goal
Link tickets that wait on other tickets or on external prerequisites.

## Scope
- Add/remove dependency: another ticket (search by ID/title) or free-text external prerequisite; mark external resolved.
- Prevent self-dependency and cycles (DFS check).
- Ticket page: "Waiting on" and "Blocking" lists with status badges; unresolved dependency count on list rows.
- `src/server/tickets/dependencies.ts` `getDependencyGraph(filter)` — reused by AI bottleneck detection (S30).

## Acceptance criteria
1. Cycles (A→B→A) rejected.
2. Both directions displayed on each ticket.
3. Changes recorded in history.

## Validation
- tsx: create A→B, attempt B→A (rejected); fetch both ticket pages and grep for each other's IDs.

## Implementation notes
_(implementer fills, ≤6 lines)_
