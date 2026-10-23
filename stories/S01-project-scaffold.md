# S01 — Project scaffold and tooling
model: sonnet · deps: — · PRD: §12

## Goal
A runnable empty app with the agreed stack, plus the `validate` gate every later story depends on.

## Scope
- Next.js (App Router, TS strict, `src/` dir), Tailwind, shadcn/ui init (button, input, card, table, dialog, select, badge, textarea, dropdown-menu, sonner).
- Prisma + PostgreSQL; `docker-compose.yml` with a `db` service (postgres:16, port 5432, named volume).
- Scripts: `dev`, `build`, `start`, `typecheck` (tsc --noEmit), `lint`, `validate` (typecheck && lint && build), `db:migrate`, `db:reset` (prisma migrate reset --force, runs seed), `db:seed`, `worker` (tsx worker/index.ts — stub logging "worker up"), `smoke` (tsx scripts/smoke.ts).
- `scripts/smoke.ts`: tiny runner — array of named async checks, prints PASS/FAIL, exits 1 on any failure. First check: GET `/api/health`.
- `src/app/api/health/route.ts` → `{ ok: true, db: true|false }` (runs `SELECT 1`).
- `.env.example` (DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY optional, SMTP_*, APP_TZ=Asia/Kolkata). `.gitignore` incl. `.env`, `uploads/`, `.harness/tmp/`.
- Empty folder skeleton per CLAUDE.md Layout.

## Acceptance criteria
1. `pnpm install && pnpm validate` passes on a clean clone.
2. With `docker compose up -d db`, `pnpm dev` serves `/api/health` → `{"ok":true,"db":true}`.
3. `pnpm smoke` passes against the running dev server.
4. README has a ≤10-line quick start (Docker, env, db:reset, dev, worker).

## Validation
- `pnpm validate`; start db + dev; `curl -s localhost:3000/api/health`; `pnpm smoke`.

## Implementation notes
_(implementer fills, ≤6 lines)_
