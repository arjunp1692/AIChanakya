# S22 — CEO decision register
model: sonnet · deps: S15, S19 · PRD: §6 decision register, §9 (CEO decision requested), §10 Decision Assistant

## Goal
Every decision the CEO owes is tracked from request to outcome.

## Scope
- Request decision from ticket page or daily report (S15 already creates rows): question, requesting dept, business impact, options (list), recommendation, decision deadline.
- Every new decision request (from either path) notifies the CEO and CEO_OFFICE in-app (FR-05 "pending CEO decisions"); deadline reminders and overdue escalation are S20's `decision-due` job.
- `/decisions`: register with requesting dept, impact, options, deadline, status, **age (days)**, overdue flag; filters.
- CEO only: record decision (chosen option / free text outcome, note) → DECIDED, decidedBy/At, TicketEvent on linked ticket, notify requester. Requester can withdraw.
- Linked ticket shows decision status; ticket in AWAITING_APPROVAL can be moved by decision outcome.

## Acceptance criteria
1. Only CEO can decide (CEO_OFFICE gets 403).
2. Register shows age and overdue past deadline.
3. Decision outcome is visible on the linked ticket's history and notifies requester.
4. Creating a decision request (ticket page or report) creates a Notification for the CEO.

## Validation
- tsx/curl: decide as ceooffice@ (403) and ceo@ (ok); check TicketEvent + Notification.

## Implementation notes
_(implementer fills, ≤6 lines)_
