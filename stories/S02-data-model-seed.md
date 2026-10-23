# S02 — Core data model and seed data
model: opus · deps: S01 · PRD: §2, §3, §8, §9

## Goal
The complete Prisma schema for the whole product, so later stories rarely need to migrate, plus realistic seed data.

## Scope
Models (names indicative):
- `Department` (code **String** unique, 2–5 uppercase letters — not a Prisma enum, so new departments need no migration (PRD §11 Scalability); seeded EDT|BRD|PRD|MKT|HR|OPS|COM|PRO; name, hodUserId, active).
- `User` (name, email, passwordHash, role CEO|CEO_OFFICE|HOD|MEMBER|VIEWER, departmentId, active).
- `Ticket` (ticketNo unique e.g. `KN-OPS-2026-00125`, title, description, departmentId, ownerId **required**, priority CRITICAL|HIGH|MEDIUM|LOW, status NEW|ASSIGNED|IN_PROGRESS|BLOCKED|AWAITING_APPROVAL|ON_HOLD|COMPLETED|CANCELLED, progress 0–100, dueDate?, originalDueDate?, noDeadlineReason?, blockerReason?, confidential, duplicateOfId?, createdAt, completedAt?, validatedById?, validatedAt?, reopenCount, extensionCount, createdById).
- `TicketAssignee` — co-assignees only (ticketId, userId, responsibility, contributionStatus, progress, updatedAt).
- `TicketDependency` (ticketId, dependsOnTicketId?, externalPrerequisite?, resolved).
- `TicketEvent` — ticket update history (ticketId, actorId, type, field?, fromValue?, toValue?, reason?, at).
- `Comment`; `Attachment` (ticketId, kind FILE|LINK, url/path, name, isEvidence, uploadedById, reportId? — set when added via a daily report).
- `DeadlineChange` (ticketId, from, to, reason, requestedById, approvedById?, at).
- `DailyReport` (departmentId, reportDate, submittedById, submittedAt, revision, isLatest, payload Json snapshot, highestPriority, blockersText, nextDayPriorities, fillSeconds? — form time, proxy for manual reporting effort, PRD §14); unique(departmentId, reportDate, revision).
- `DailyReportItem` (reportId, ticketId, section COMPLETED|IN_PROGRESS|NEW|PENDING|DELAYED|BLOCKED, note, progress).
- `Escalation` (ticketId?, departmentId?, decisionId?, trigger DEADLINE_MISSED|REPEATED_DELAY|CRITICAL_BLOCKER|MISSED_REPORT|REPORT_CRITICAL|DECISION_OVERDUE, impact, requiredAction, level, status OPEN|ACK|RESOLVED, createdAt, resolvedAt).
- `Decision` (ticketId?, departmentId, requestedById, question, businessImpact, options Json, recommendation, decisionDeadline, status PENDING|DECIDED|WITHDRAWN, outcome?, decidedById?, decidedAt?).
- `Notification` (userId, kind, title, body, link, channel, readAt, sentAt).
- `ActivityLog` — global audit (actorId, entity, entityId, action, diff Json, at).
- `Setting` (key, value Json) — cut-off, reminder windows, thresholds, validation policy.
- `AiInsight` (kind BRIEF|DELAY_PATTERN|BOTTLENECK|DECISION_DRAFT, decisionId?, periodStart, periodEnd, content Json, citedTicketNos String[], model, createdAt, reviewStatus UNREVIEWED|REVIEWED|DISMISSED, reviewedById?, reviewedAt?, reviewNote? — PRD §15 human validation).
- `WeeklySnapshot` (periodStart, periodEnd, departmentId?, metrics Json, createdAt).
- `TicketCounter` (departmentCode, year, last).
- Migration enabling `pg_trgm` + trigram index on `Ticket.title`.

Seed (`prisma/seed.ts`): 8 departments; users `ceo@`, `ceooffice@`, `viewer@`, and per dept `hod.<code>@`, `<code>.m1@`, `<code>.m2@` (all `@kubera.local`, `Password@123`, bcrypt, lowercase codes); default Settings; ~40 tickets across depts/statuses incl. overdue, blocked, extended, cross-dept co-assignees; 3 pending decisions; 5 days of daily reports for 6 depts (2 depts missing a day).

## Acceptance criteria
1. `pnpm db:reset` succeeds from scratch.
2. Every seeded ticket has an owner and either dueDate or noDeadlineReason.
3. Seed covers every status and priority, ≥3 overdue, ≥2 with extensionCount ≥2, ≥3 with cross-dept co-assignees.
4. `pnpm validate` passes.

## Validation
- `pnpm db:reset`; tsx script printing counts by status/priority/department and asserting criteria 2–3.

## Implementation notes
_(implementer fills, ≤6 lines)_
