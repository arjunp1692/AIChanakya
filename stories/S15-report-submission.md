# S15 — Report submission → ticket updates
model: opus · deps: S14, S10, S13 · PRD: FR-02, §4 workflow principle, §7 production requirements, §11 Data integrity

## Goal
The daily report is the input into the ticket database, not a separate document.

## Scope
- `src/server/reports/submit.ts` `submitDailyReport(user, input)` in one transaction:
  - Linked rows → update existing ticket (status via workflow service, progress, note as comment, deadline change via S10 service). **Never** create a new ticket for a linked row.
  - New rows → `createTicket` (S06 service) with owner/co-assignees/dependencies.
  - Decision requests → `Decision` rows (PENDING) linked to ticket if given.
  - Store `DailyReport` with immutable `payload` snapshot + `DailyReportItem` per row; `submittedAt`, `submittedById`.
  - Resubmission for same dept+date → new `revision`, previous `isLatest=false`; never overwrite old payload. Edits logged in ActivityLog.
  - Idempotency key from client prevents double-click duplicates.
  - Row attachments → `Attachment` on the row's ticket via S13 storage (same mime/size rules), with `reportId` set.
  - `fillSeconds` = submittedAt − client `startedAt` (ignore if missing or > 4 h).
- After submit: confirmation page listing created ticketNos and updated tickets; `/reports/daily` list (dept, date, submitter, time, revision) with view of snapshot.
- Snapshot view redacts rows whose ticket the viewer may not see (confidential): shows "Confidential item", with no title, note or attachments (PRD §11 Privacy, §15).

## Acceptance criteria
1. A report with 2 linked + 1 new row updates 2 tickets and creates exactly 1 ticket.
2. Same idempotency key twice → one report.
3. Resubmission creates revision 2; revision 1 payload unchanged and viewable.
4. Ticket history shows the update came from the daily report (event source = report id).
5. Statuses go through workflow rules (illegal transition in a report is rejected with a row-level error).
6. A link attachment on a report row appears on that ticket's attachments with `reportId` set.
7. viewer@ opening a snapshot that contains a confidential HR ticket sees it redacted.

## Validation
- tsx script submitting as hod.edt@ (via service) and asserting criteria 1–6 against DB; GET a snapshot containing an HR confidential row as viewer@ and grep for "Confidential item".

## Implementation notes
_(implementer fills, ≤6 lines)_
