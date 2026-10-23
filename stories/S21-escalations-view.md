# S21 — Escalations list and handling
model: sonnet · deps: S20 · PRD: FR-05, §6 CEO attention

## Goal
Leadership can see, acknowledge and resolve escalations.

## Scope
- `/escalations`: filters (status, level, trigger, dept), columns ticket, owner, dept, trigger, impact, required action, age, status. Visibility via `can(escalation.view)` (HOD sees own dept).
- Acknowledge (HOD+/CEO_OFFICE) and resolve with note → ActivityLog; auto-resolve when underlying condition clears (ticket completed / report submitted / decision decided or withdrawn) via the engine. REPORT_CRITICAL is resolved manually only.
- Live refresh via S18.

## Acceptance criteria
1. CEO sees all; hod.edt@ sees only EDT escalations.
2. Ack/resolve recorded with actor and time.
3. Completing an overdue ticket auto-resolves its DEADLINE_MISSED escalation.

## Validation
- GET `/escalations` as ceo@ vs hod.edt@ and compare counts with DB; complete a ticket via service and re-run engine; check status.

## Implementation notes
_(implementer fills, ≤6 lines)_
