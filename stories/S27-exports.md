# S27 — CSV/XLSX and PDF exports
model: sonnet · deps: S24, S26 · PRD: §11 Export

## Goal
Data leaves the system in management-friendly formats, with the same permissions as on screen.

## Scope
- Ticket list export: current filters → CSV and XLSX (`exceljs`), via `listTickets` (S07) so visibility rules apply. Columns = PRD §8 fields (co-assignees joined, original vs current due date, overdue flag).
- Weekly report PDF (`@react-pdf/renderer`): KPI cards, attention items, dept table, decision register, generated-at footer; from a snapshot or live period.
- Export actions logged in ActivityLog (who exported what filter).

## Acceptance criteria
1. Export row count equals the on-screen filtered total.
2. A member's export never contains tickets they can't view.
3. PDF opens and shows the same KPI numbers as the dashboard for that period.

## Validation
- curl export endpoints as ceo@ and edt.m1@; count CSV lines vs list totals; open the PDF and extract its text to compare numbers.

## Implementation notes
_(implementer fills, ≤6 lines)_
