# S03 — Authentication and login
model: sonnet · deps: S02 · PRD: §3, §11 Security

## Goal
Secure login, with a session that knows the user's id, role and department.

## Scope
- Auth.js credentials provider (bcrypt); JWT session with `id, role, departmentId, name`.
- `/login` page (shadcn form), logout; `middleware.ts` protecting all routes except `/login`, `/api/health`, `/api/auth/*`.
- `src/server/auth/session.ts`: `requireUser()` for server code.
- Inactive users cannot log in.

## Acceptance criteria
1. Valid seed credentials log in and land on `/`; a wrong password shows an error.
2. Unauthenticated GET `/` redirects to `/login`; `/api/health` stays public.
3. `requireUser()` returns role and departmentId from the session.
4. Deactivated user cannot log in.

## Validation
- curl `/` without cookie → redirect to `/login`. Log in via the credentials callback with a curl cookie jar (csrf flow); GET `/` → 200. Set a user inactive via tsx, retry → fails.

## Implementation notes
_(implementer fills, ≤6 lines)_
