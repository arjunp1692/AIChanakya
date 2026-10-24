# S04 — Permission policy and app shell
model: opus · deps: S03 · PRD: §3, FR-08, §11 Privacy · PLAN §1 (visibility)

## Goal
One central permission module that every service uses, plus role-aware navigation.

## Scope
- `src/server/authz/index.ts`: `can(user, action, resource?)`, `assertCan(...)`, and `ticketVisibilityWhere(user)` (Prisma where-filter). Actions: ticket.view/create/edit/assign/changeStatus/changeDeadline/validate/comment/contribute, report.submit/view, decision.request/decide, escalation.view/resolve, settings.manage, admin.users, admin.departments, ai.review, dashboard.ceo.
- Rules (write as a comment matrix at top of the module):
  - CEO: everything; only CEO can `decision.decide`.
  - CEO_OFFICE: everything except decide; manages settings, users and departments; `ai.review` (with CEO).
  - VIEWER: read-only on all non-confidential tickets, dashboards, reports.
  - HOD: full on own-dept tickets; view tickets they're assigned to or that depend on/are depended on by own-dept tickets; submit own-dept report; request decisions.
  - MEMBER: view own-dept + assigned tickets; edit tickets they own; `contribute` only on own co-assignment.
  - Confidential tickets: owner, co-assignees, dept HOD, CEO, CEO_OFFICE only.
- App shell: sidebar + topbar (user, role, department), nav filtered by `can` — Dashboard, Tickets, Daily Report, Decisions, Escalations, Reports, Settings, Admin. Placeholder pages for routes not yet built.
- `ForbiddenError` → 403 page `/forbidden`.

## Acceptance criteria
1. Rules matrix documented in the authz module and implemented.
2. Nav differs per role (CEO sees Dashboard/Decisions/Settings; MEMBER doesn't see Settings/Admin/CEO Dashboard).
3. A direct URL to a forbidden page shows the forbidden page, not data.

## Validation
- Log in as ceo@, hod.edt@, edt.m1@, viewer@; fetch `/` HTML and grep nav labels. GET `/settings` as edt.m1@ → forbidden.

## Implementation notes
- `src/server/authz/index.ts`: matrix comment + `can`/`assertCan`/`ForbiddenError`/`ticketVisibilityWhere`. Ticket checks take a `TicketResource` {departmentId, ownerId, confidential, assigneeIds?, linkedDepartmentIds?}; services must load assignees + dependency depts. No resource = "could this role ever" (nav/buttons). Every ticket action requires view.
- Interpretations: MEMBER may edit/changeStatus/request changeDeadline on tickets they own, cannot create; HOD can't see CEO dashboard; VIEWER gets dashboard.ceo, report.view, escalation.view only. `where` filter verified equal to `can("ticket.view")` over all seed users×tickets.
- Shell: route group `src/app/(app)/layout.tsx` (sidebar + topbar, mobile horizontal nav); nav config `src/lib/nav.ts` (`NAV_ITEMS`, `navAccess(href)`). `/` = Home (always shown); CEO dashboard lives at `/dashboard`.
- Pages guard with `requirePermission(...actions)` (`src/server/auth/session.ts`) → redirect `/forbidden` (307 then 200 page, not a true 403 status). Placeholders use `src/components/placeholder-page.tsx`.
- Follow-up: map `ForbiddenError` thrown from server actions/route handlers to 403 responses (S06+).
