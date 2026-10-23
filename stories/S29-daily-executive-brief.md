# S29 — Daily Executive Brief
model: sonnet · deps: S28, S20 · PRD: §10 Daily Executive Brief, §15 (excessive notifications)

## Goal
One consolidated daily summary for the CEO instead of many alerts.

## Scope
- Deterministic part first (no AI): major completions, important new tasks (HIGH/CRITICAL), overdue items, key blockers, decisions pending — computed from DB for "since last brief".
- AI part: send that fact list to Claude (S28) for a ≤150-word narrative + top 3 attention items, each citing ticketNos.
- Job `daily-brief` at Setting `brief.time` (default 20:30 IST, after report cut-off) → AiInsight(BRIEF) + notification/email to CEO & CEO_OFFICE. "Generate now" button on dashboard.
- Dashboard card shows latest brief via `<AiInsightCard>`; if AI unavailable, show the deterministic part only.

## Acceptance criteria
1. Brief renders with facts even with no API key.
2. With key, narrative cites only ticketNos present in the facts.
3. Job is idempotent per day.

## Validation
- `pnpm worker -- --run-once daily-brief` with and without key; inspect AiInsight row and dashboard HTML.

## Implementation notes
_(implementer fills, ≤6 lines)_
