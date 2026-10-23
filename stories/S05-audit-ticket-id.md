# S05 — Audit log service and ticket ID generator
model: sonnet · deps: S02 · PRD: FR-01, FR-08, §8

## Goal
Shared primitives that every mutation uses.

## Scope
- `src/server/audit`: `logActivity(tx, {actor, entity, entityId, action, before, after})` storing a field-level diff; `recordTicketEvent(tx, …)` for ticket history.
- `src/server/tickets/id.ts`: `nextTicketNo(tx, deptCode, date)` — `TicketCounter` upsert+increment inside the caller's transaction → `KN-<CODE>-<YYYY>-<00001>`.
- `src/lib/constants.ts`: statuses, priorities, labels, badge colours, and the 8 seed departments. The live department list always comes from the `Department` table, never from constants (departments can be added in S33).

## Acceptance criteria
1. 20 concurrent `nextTicketNo` calls for one dept/year yield 20 unique sequential numbers.
2. `logActivity` diff contains only changed fields.
3. `pnpm validate` passes.

## Validation
- tsx script in `.harness/tmp/` firing 20 parallel transactions and asserting uniqueness; script calling `logActivity` and printing the stored diff.

## Implementation notes
_(implementer fills, ≤6 lines)_
