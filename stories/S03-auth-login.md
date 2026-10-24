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
- `next-auth@5.0.0-beta.32`. Edge-safe `src/server/auth/config.ts` (callbacks, public paths, Session/User type augmentation) is shared by `src/middleware.ts`; `src/server/auth/index.ts` adds the Credentials provider (Prisma + bcryptjs, Zod) and exports `auth, signIn, signOut, handlers`.
- Public: `/login`, `/api/health`, `/api/auth/*`; a signed-in user hitting `/login` is redirected to `/`. `trustHost: true` (self-hosted).
- `requireUser()` (`src/server/auth/session.ts`) returns `{id,name,email,role,departmentId}` and redirects to `/login` when signed out. Session is JWT, so role/dept changes and deactivation only apply at the next login (follow-up: re-check `active` in `requireUser` or shorten maxAge).
- Login/logout server actions are in `src/app/login/actions.ts`; `/` is a placeholder showing the user plus a logout button (S04 replaces it with the app shell).
- JWT claims are typed with a local `AppToken` cast because `next-auth/jwt` can't be resolved for module augmentation under pnpm.
