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
- `src/server/reports/submit.ts` `submitDailyReport(user, input, files?)`; `view.ts` (`listDailyReports`, `getReportSnapshot`: the only reader of `payload` for display, redacts server-side, fails closed). Routes `/reports/daily`, `/[id]`, `/[id]/submitted`; `/reports` redirects there. Action: `report/actions.ts`.
- Ticket services take optional `opts: ServiceOpts` (`tickets/tx.ts`: `tx`, `reportId`, `storedKeys`); reads inside must use `dbOf(opts)`. Schema: `TicketEvent.reportId`, `DailyReport.idempotencyKey` (unique per submitter), `DailyReportItem.rowKey/created`.
- Resubmission matches rows by `rowKey` and applies only differences; a new row never recreates its ticket (title/owner edits are ignored, only note + attachments apply). Form's "Load submitted report" keeps keys. Decisions dedupe by question. Removing a row reverses nothing.
- Status changes only via a row's explicit `status`, not its section. Attachments on COMPLETED rows count as evidence. `decisionRequests[].ticketNo` added. Blank decision deadline = report date + 3 days. Report files capped at 50 MB (`bodySizeLimit` 55mb). Any row error rolls back the whole report (`items.<i>.<field>`).
- Check: `pnpm exec tsx .harness/tmp/s15-check.ts` (BASE_URL :3100, creates fixture tickets). After pulling: run `pnpm exec prisma generate` with dev stopped, then restart dev.
- Follow-ups: `blockersText`/`nextDayPriorities` aren't redacted, so free text in a confidential dept's report is visible to viewers; S19 should notify on new decisions; S22 should parse `options` (stored as one label).
