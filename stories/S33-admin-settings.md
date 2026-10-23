# S33 — Admin: users, departments and settings
model: sonnet · deps: S20 · PRD: §3, §9 (configurable), §11 Scalability, §16 (departments configured), §17

## Goal
CEO Office runs the system without developer help.

## Scope
- `/admin/users` (admin.users): create/edit/deactivate users, set role + dept, reset password; HOD assignment per department. All changes in ActivityLog.
- `/admin/departments` (admin.departments): create department (code, name, HOD), rename, deactivate (never delete; inactive depts keep history but get no new tickets, reports or compliance rows). All changes in ActivityLog.
- `/settings` (settings.manage): typed form for every Setting key (cut-off time, working days, reminder windows incl. `report.reminderBeforeMinutes` and `decision.reminderHours`, escalation thresholds, notification channels per priority, completion evidence/validation priorities, `confidential.defaultDepts`, similarity threshold, priority weights, brief time, consistency thresholds (S37), KPI targets/baseline (S38)). Zod per key; changes logged with before/after.
- `/admin/audit`: searchable ActivityLog (entity, actor, date).

## Acceptance criteria
1. Deactivated user can't log in; their open tickets are listed for reassignment.
2. Changing cut-off time changes compliance late/on-time classification without restart.
3. Only CEO_OFFICE/CEO can access these pages.
4. A newly created department (e.g. `LEG`) works with no code change: tickets get `KN-LEG-<YYYY>-00001`, and it appears in the report form, compliance grid, dashboard filter and weekly snapshot.

## Validation
- curl as ceooffice@ and hod.edt@; change `report.cutoff` and recompute compliance via tsx. Create dept `LEG` with a HOD, create a ticket in it, GET `/` and `/reports/compliance` and grep `LEG`.

## Implementation notes
_(implementer fills, ≤6 lines)_
