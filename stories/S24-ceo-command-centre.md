# S24 — CEO Command Centre dashboard
model: sonnet · deps: S23, S18 · PRD: §6, FR-06

## Goal
The principal management screen from PRD §6, built on real data with drill-down.

## Scope
- `/` for roles with `dashboard.ceo` (CEO, CEO_OFFICE, VIEWER); HOD lands on a dept-scoped version of the same page.
- Controls: period (This week / Last week / This month / custom range), department filter (All + every active department, read from DB).
- KPI cards: Tasks assigned · Completed % · Pending · Delayed — each a link to `/tickets?ids=…` (or equivalent filters) giving exactly the underlying tickets.
- "CEO attention required": Critical issues · Repeated delays · CEO decisions pending — each drillable.
- Sections (tabs): Executive overview · Department-wise performance (table + bar chart) · Delayed & recurring tasks · CEO decisions & escalations (links to S21/S22).
- Separate counters for created this period vs completed this period vs carried forward (PRD §6 integrity).
- Live refresh (S18). Week starts Monday IST.

## Acceptance criteria
1. Every KPI number equals the row count of its drill-down list.
2. Changing period/department updates all numbers and drill-down links.
3. Created / completed / carried-forward are shown as three distinct numbers.
4. MEMBER gets forbidden.

## Validation
- As ceo@: fetch dashboard HTML for 2 periods; for each KPI follow its link and compare row counts (script). Manual UI: visual check of chart and tabs.

## Implementation notes
_(implementer fills, ≤6 lines)_
