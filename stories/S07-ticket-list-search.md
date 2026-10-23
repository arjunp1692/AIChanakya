# S07 — Ticket list, search and filters
model: sonnet · deps: S06 · PRD: §11 Search, FR-04

## Goal
Find any visible ticket fast. This list is also the drill-down target for the dashboard.

## Scope
- `/tickets` with TanStack Table: ticketNo, title, dept, owner, priority, status, progress, due date, overdue badge (computed), last updated.
- Filters in **URL query params** (so dashboard can deep-link): `q` (ID or title), `dept`, `owner`, `assignee`, `status` (multi), `priority`, `overdue=1`, `createdFrom/To`, `completedFrom/To`, `ids` (comma list). Server-side pagination (25) and sort.
- Always filtered by `ticketVisibilityWhere(user)`.
- `src/server/tickets/query.ts` `listTickets(user, filters)` — reused later by dashboard/exports.

## Acceptance criteria
1. Search by exact ticket ID and by partial title works.
2. Every filter works and is reflected in the URL; reload keeps filters.
3. edt.m1@ never sees tickets outside visibility rules (incl. confidential).
4. Overdue badge = open status and due date < now.

## Validation
- curl `/tickets?q=KN-EDT` etc. as different users; compare result counts with a direct Prisma query using the same rules.

## Implementation notes
_(implementer fills, ≤6 lines)_
