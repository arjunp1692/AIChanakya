# S18 — Real-time updates
model: sonnet · deps: S09 · PRD: FR-04, §11 Real-time

## Goal
A permitted update shows up on open screens without a page refresh.

## Scope
- `src/server/realtime`: `publish(event)` → `pg_notify('chanakya', json)` after transaction commit (ticket.updated, ticket.created, report.submitted, escalation.created, decision.updated, notification.created). Hook into ticket/report services.
- `/api/stream` SSE route: authenticates user, `LISTEN chanakya` on a dedicated pg connection, forwards only events the user may see (check `can`), heartbeat 25s.
- Client hook `useLiveRefresh(topics)` → `router.refresh()` (debounced 1s). Wire into ticket list, ticket detail, and (later) dashboard.

## Acceptance criteria
1. Status change by user A appears on user B's open ticket list within ~2s without reload.
2. User without visibility receives no event for that ticket.
3. Works with two app instances (LISTEN/NOTIFY, not in-memory).

## Validation
- `curl -N` the stream as ceo@ and as an unrelated member; trigger an update via tsx; check which stream received the event.

## Implementation notes
_(implementer fills, ≤6 lines)_
