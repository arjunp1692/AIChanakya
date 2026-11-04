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
- `src/server/tickets/similar.ts`: `findSimilarTickets(deptId, title)` (no user, for later stories) and `suggestSimilarTickets(user, …)` (visibility-filtered, max 5). Show users only the second. Dept scope mirrors `deptTicketWhere`. Setting `duplicate.similarityThreshold`, default 0.45 when unset.
- `createTicket` enforces it for every caller (form, API, report): a match without `duplicateOverride` throws TicketInputError field `duplicateOverride` (report: `items.<i>.duplicateOverride`). With a match, a DUPLICATE_OVERRIDE event lists the ticket IDs. Only tickets the creator can see count, so a hidden confidential ticket never blocks or reveals itself.
- Rows of one report are checked against each other (second identical row is rejected). Resubmitted rows skip the check, and the form skips suggestions for them since they'd match their own ticket. Editing a title clears the override.
- `src/server/tickets/duplicates.ts` `markDuplicate` (new action `ticket.markDuplicate`: HOD own dept, CEO_OFFICE, CEO) cancels via `changeStatus`, so only statuses that can reach CANCELLED qualify (not COMPLETED/AWAITING_APPROVAL). Original must be visible and not cancelled, which rules out chains.
- `/tickets/new` has nothing to link to, so its action is "Open existing"; the report form's "Link to existing" turns the row into a linked row. S23 must exclude `duplicateOfId IS NOT NULL` from metrics (PLAN §5); no metrics exist yet.
- Check: `pnpm exec tsx --env-file=.env .harness/tmp/s17-check.ts` (BASE_URL default :3000, removes its fixtures). Follow-ups: `updateTicket` title edits aren't checked; matching is title-only.
