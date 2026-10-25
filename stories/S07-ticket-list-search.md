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
- `src/server/tickets/query.ts`: `listTickets(user, filters, {pageSize?, now?})` → {rows(+computed `overdue`), total, page, pageSize, pageCount}; also `ticketListWhere` (visibility AND filters — use for dashboard counts/exports), `ticketFilterWhere`, `overdueWhere`, `isOverdue`, `TICKET_PAGE_SIZE`=25.
- `src/lib/schemas/ticket-filters.ts` `parseTicketFilters(searchParams)`: lenient (bad values dropped, never throws). `dept` = dept **code(s)**; `owner`/`assignee` = user id; `status`/`priority`/`dept`/`ids` accept repeated params or comma lists; `ids` matches ticketNo or id; dates `YYYY-MM-DD` = IST day bounds; `sort` ∈ TICKET_SORT_KEYS, `dir` asc|desc, `page`.
- `q` = case-insensitive `contains` on ticketNo OR title (so `q=KN-EDT` lists a dept's tickets). Overdue = dueDate < now AND status not in CLOSED_STATUSES.
- UI: `/tickets` server page with a GET form (URL is the state) + client `ticket-table.tsx` (@tanstack/react-table **v8**, manual sort/pagination; header links toggle sort). Form selects show only the first dept/priority from a multi-value deep link.
- Validation: `pnpm exec tsx .harness/tmp/s07-check.ts` compares listTickets with an independent `can("ticket.view")` + in-memory filter over all users × 16 cases. Running `pnpm validate` while `pnpm dev` runs breaks the dev server's `.next` → restart dev.
