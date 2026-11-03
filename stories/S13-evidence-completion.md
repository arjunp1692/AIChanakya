# S13 — Attachments, evidence and completion validation
model: sonnet · deps: S09 · PRD: FR-01, §8 Evidence/Closure, §9 (Task marked completed), PLAN §1 validation

## Goal
Completion is backed by evidence and validated where policy requires.

## Scope
- `src/server/storage` interface with local-disk impl (`uploads/`, 10 MB limit, allowlisted mime types); link attachments.
- Upload/list/download attachments on ticket page (download permission-checked via route handler).
- Completing a ticket: optional evidence for Medium/Low, **required** evidence (file or link) for priorities in Setting `completion.requireEvidence` (default CRITICAL, HIGH).
- Priorities in Setting `completion.requireValidation` (default CRITICAL, HIGH) go to AWAITING_APPROVAL; HOD of ticket dept (or CEO_OFFICE) validates → COMPLETED with validatedBy/At, or rejects → IN_PROGRESS with reason.
- Completion timestamp captured.

## Acceptance criteria
1. Critical ticket cannot complete without evidence.
2. Critical ticket completion by owner lands in AWAITING_APPROVAL; HOD validation completes it with validator recorded.
3. Attachment download is denied to users who can't view the ticket.

## Validation
- tsx/curl flows for a CRITICAL and a LOW ticket; DB check of validatedById, completedAt; unauthorized download → 403.

## Implementation notes
- `src/server/storage`: `Storage` interface + local-disk impl (`uploads/`, or `UPLOAD_DIR`), `MAX_UPLOAD_BYTES` 10 MB, `ALLOWED_FILE_TYPES` ext→mime (content type derived from key; no schema change). S35 swaps impl for S3.
- `src/server/tickets/attachments.ts`: `addAttachment` (FILE/LINK, `isEvidence`; owner/HOD/co-assignees via `canAttach`; ATTACHMENT_ADDED event field `evidence`|`attachment`), `getAttachmentDownload`; route `GET /api/attachments/[id]` (403 if ticket not viewable, LINK → redirect). Uploads use a server action; `next.config.ts` bodySizeLimit 11mb.
- workflow.ts: `completionPolicy(priority)` reads Settings `completion.requireEvidence`/`requireValidation` (default CRITICAL, HIGH; seed replaces old `completion.validationPolicy`). Evidence = ≥1 `isEvidence` attachment, checked in the tx on COMPLETED and on submission.
- Non-validator choosing COMPLETED on a validation priority → AWAITING_APPROVAL. Leaving AWAITING_APPROVAL needs `ticket.validate` (HOD own dept / CEO_OFFICE / CEO): COMPLETED sets `validatedById/At`; IN_PROGRESS is a rejection needing a reason. A validator completing directly is recorded as validator. Reopen clears validatedBy/At.
- `allowedNextStatuses(user, from, canValidate)` gained a 3rd arg; `StatusOption` has optional `label`/`hint`. Check: `pnpm exec tsx .harness/tmp/s13-check.ts` (creates test tickets). Anonymous download gets the middleware 307 to /login.
- Follow-ups: no attachment delete; seeded DB still has old `completion.validationPolicy` until `pnpm db:reset` (code defaults cover it); S19 should notify HOD on submission.
