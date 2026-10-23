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
_(implementer fills, ≤6 lines)_
