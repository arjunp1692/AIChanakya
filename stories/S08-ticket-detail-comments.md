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
- `src/server/tickets/detail.ts`: `getTicketDetail(user, ticketNo)` → null if missing, throws ForbiddenError if not viewable (page redirects `/forbidden`); `resourceInclude` + `toTicketResource(t)` build the authz `TicketResource` (assignees + linked depts) — reuse in every ticket mutation.
- `service.ts` `updateTicket(user, ticketId, input)`: needs `ticket.edit`; owner change also needs `ticket.assign` + `ownerReason` (else `TicketInputError("ownerReason")`) + active owner in the ticket's dept. Only changed fields written; one `FIELD_CHANGED` TicketEvent per field (owner stored as user IDs, reason on the event), one ActivityLog `UPDATE`. No status change on reassignment (S09 owns status).
- `addComment(user, ticketId, input)`: Comment + TicketEvent `COMMENT` (toValue = comment id) + ActivityLog entity `Comment`/`CREATE`.
- UI: `/tickets/[ticketNo]` server page (cards: description, comments, history newest-first, details, co-assignees/deps/attachments read-only) + client `ticket-forms.tsx` (inline edit, comment) via server actions in `actions.ts` (bound ticketId/ticketNo, `revalidatePath`).
- Validation: `pnpm exec tsx .harness/tmp/s08-check.ts` (creates an EDT ticket, edits/comments, checks 400/403, cleans up; burns one ticket number).
