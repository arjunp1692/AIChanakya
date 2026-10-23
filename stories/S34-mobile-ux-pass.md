# S34 — Mobile and usability pass
model: sonnet · deps: S24, S16 · PRD: §11 Usability, Performance

## Goal
The HoD report and the CEO dashboard work well on a phone.

## Scope
- Responsive audit of `/`, `/report`, `/tickets`, `/tickets/[id]`, `/decisions` at 375px: no horizontal scroll, tables collapse to cards, sticky submit bar on report form.
- Loading skeletons and empty states for lists/dashboard.
- DB indexes for common filters (status, departmentId, ownerId, dueDate, createdAt, completedAt) if missing; dashboard query < 500 ms on seed ×10 data (add `pnpm db:seed:large`).

## Acceptance criteria
1. Listed pages usable at 375px width (manual check list in notes).
2. Dashboard server render < 500 ms with large seed (log timing).
3. Report form submittable on mobile without zooming.

## Validation
- `pnpm db:seed:large`, time dashboard request with curl `-w %{time_total}`; manual mobile check via browser devtools.

## Implementation notes
_(implementer fills, ≤6 lines)_
