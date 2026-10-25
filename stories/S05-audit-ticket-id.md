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
- `src/server/tickets/id.ts`: `nextTicketNo(tx, deptCode, date?)` uses one raw `INSERT … ON CONFLICT DO UPDATE SET last=last+1 RETURNING` (row lock → no dupes under concurrency); year = IST calendar year. `formatTicketNo` exported.
- `src/server/audit/index.ts`: `logActivity(tx,{actor,entity,entityId,action,before,after})` stores `{field:{from,to}}` for changed keys only (Dates → ISO, `updatedAt` ignored); `diffFields` exported. `recordTicketEvent(tx,{ticketId,actor,type,field?,from?,to?,reason?})` stringifies values.
- `src/lib/constants.ts`: `TICKET_STATUSES`, `STATUS_LABELS/BADGE`, `CLOSED_STATUSES`, `PRIORITIES`, `PRIORITY_LABELS/BADGE`, `REPORT_PRIORITY_LABELS`, `OVERDUE_BADGE`, `SEED_DEPARTMENTS` (reference only; live list = `Department` table).
- Validation: `pnpm exec tsx .harness/tmp/s05-check.ts` (20 parallel txs on test dept ZZT/2031 + diff print; cleans up after itself). Shell PATH may lack node/pnpm: prepend `C:\Program Files\nodejs` and `%APPDATA%\npm`.
