# S19 — Notification centre and channels
model: sonnet · deps: S18 · PRD: FR-05, §17.2, §15 (excessive notifications)

## Goal
One `notify()` API with in-app and email delivery and per-priority routing.

## Scope
- `src/server/notify`: `notify({userIds, kind, title, body, link, priority})` → Notification rows + channel adapters: `inApp` (always), `email` (Nodemailer SMTP; console transport when SMTP unset), `whatsapp` stub (logs "not configured").
- Routing Setting `notify.channels` per priority (default: CRITICAL/HIGH → in-app+email, others → in-app).
- Dedupe: same kind+ticket+user within Setting `notify.dedupeMinutes` (default 240) is suppressed.
- Bell icon with unread count (live via S18), `/notifications` page, mark read/all read.
- Trigger notifications for: ticket assigned to you, added as co-assignee, deadline change pending your approval, validation requested.

## Acceptance criteria
1. Assigning a ticket notifies the new owner in-app; CRITICAL also emails (visible in console transport output).
2. Duplicate notifications within dedupe window are suppressed.
3. Unread count updates live.

## Validation
- tsx: assign tickets of different priorities; query Notification rows; inspect dev server log for email output; call twice to test dedupe.

## Implementation notes
_(implementer fills, ≤6 lines)_
