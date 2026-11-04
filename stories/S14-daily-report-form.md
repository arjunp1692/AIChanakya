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
- Route is `/report` (nav moved; `/daily-report` redirects). `page.tsx` → `getReportFormData(user, deptCode)` in `src/server/reports/form.ts` (HOD own dept; CEO/CEO_OFFICE via `?dept=CODE`). Editor is `report-form.tsx`, mounted client-only (section headings are the SSR fallback).
- `src/lib/schemas/daily-report.ts` = `dailyReportSchema` for S15: `items[]` is `mode:"link"|"new"` with `section`; attachments are LINK or FILE (`fileKey`, `name`, `size`). `startedAt` is ISO, set on first edit.
- **S15:** the form stops at Preview; "Submit report" is a disabled button in `ReportPreview`. File objects live in the `files` ref (`Map<fileKey, File>`) in `ReportEditor`; send them as FormData. Clear the `kn-report-draft:<deptId>:<date>` key after submit.
- Reason is also required on Blocked rows (beyond the story) because S09's BLOCKED needs a reason. New rows require a due date (no no-deadline path). Ticket-in-dept is checked client-side only; S15 must re-check.
- Drafts keep links but not files; a restored draft asks to re-attach. `REPORT_MAX_FILE_BYTES` duplicates `MAX_UPLOAD_BYTES` (storage imports `fs`). Non-dept dependency options are capped at 300.
- Check: `pnpm exec tsx .harness/tmp/s14-check.ts` (BASE_URL default :3100). `next build` shares `.next` with a running `pnpm dev` and breaks both; stop dev first or build a copy.
