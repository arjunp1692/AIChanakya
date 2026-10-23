# S14 — HoD daily report form
model: sonnet · deps: S11, S12 · PRD: FR-02, §7

## Goal
A fast end-of-day form where HoDs link existing tickets or create new ones. Submission is S15.

## Scope
- `/report` (HOD of own dept; CEO_OFFICE can pick a dept): department, reporting date (default today IST), submitter.
- Sections: Completed today · In progress · New tasks · Pending · Delayed · Blocked · Blockers & support needed (text) · Next-day priorities (text) · Highest priority (Normal/High/Critical) · CEO decision requests (question, impact, options, recommendation, deadline).
- Each task row: either **link existing ticket** (typeahead over visible open dept tickets) with status/progress/note, or **new ticket** inline (title, owner, co-assignees, priority, due date, dependencies optional).
- Every row (linked or new) can carry optional attachments: links, or files held client-side until submit. S15 stores them through the S13 storage service (PRD §7).
- Delayed rows and any due-date change require a reason (client + Zod).
- Client draft saved to localStorage (per dept+date); Zod schema `src/lib/schemas/daily-report.ts` shared with S15.
- Draft records `startedAt` at the first edit; it is sent with the submission so S15 can store `fillSeconds`.
- Mobile-friendly layout (single column under 768px).

## Acceptance criteria
1. Form renders for hod.edt@ with EDT open tickets available to link.
2. Missing reason on a delayed row blocks preview/submit with a clear message.
3. Draft survives page reload.
4. MEMBER cannot open `/report` (forbidden).

## Validation
- GET `/report` as hod.edt@ (200, contains section labels) and as edt.m1@ (forbidden). Manual UI: fill one linked + one new row, reload, data persists.

## Implementation notes
_(implementer fills, ≤6 lines)_
