# S08 — Ticket detail, edit and comments
model: sonnet · deps: S07 · PRD: FR-01, FR-04, FR-08

## Goal
One page that shows everything about a ticket and its full history.

## Scope
- `/tickets/[ticketNo]`: header (ID, title, status, priority, overdue flag), fields panel, description, co-assignees (read-only for now), dependencies (read-only placeholder), attachments placeholder, comments, history timeline (TicketEvent, newest first, actor + timestamp + from→to + reason).
- Edit title/description/priority/owner (permission-checked) → TicketEvent per changed field + ActivityLog. Owner change requires a reason.
- Comments: add (ticket.comment), list; logged as TicketEvent(COMMENT).

## Acceptance criteria
1. Detail page shows all PRD §8 fields that exist so far.
2. Each edited field produces its own history entry with old/new value.
3. Owner change without reason is rejected.
4. User without view permission gets forbidden (not 500, not data).

## Validation
- As hod.edt@ edit priority + owner on an EDT ticket; query TicketEvent rows. As mkt.m1@ GET an EDT non-shared ticket → forbidden.

## Implementation notes
_(implementer fills, ≤6 lines)_
