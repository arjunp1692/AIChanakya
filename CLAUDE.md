# Chanakya AI — agent rules

CEO Office task/ticket system for Kubera Now. Plan: `docs/PLAN.md`. Stories: `stories/`.

## Token rules (follow strictly)
- Work on ONE story. Read its story file first; it is the context contract.
- Read only: the story file, files it lists, and "Implementation notes" of its dependency stories.
- Need PRD detail? `grep -n -A 30 "^## 9\." docs/PRD.md` for that section. Never read the whole PRD or the .docx.
- No broad repo exploration; use Grep/Glob for a specific symbol.
- Don't print large files back; don't restate the story in chat.

## Stack
Next.js App Router + TS (strict) · Tailwind + shadcn/ui · Prisma + PostgreSQL · Auth.js · Zod · pg-boss worker · SSE + LISTEN/NOTIFY · Claude API (`@anthropic-ai/sdk`). Package manager: pnpm. Node 22.

## Layout
- `src/app/` routes, thin: parse input → call service → render.
- `src/server/<domain>/` business logic. All mutations go through services that (1) check `can()` from `src/server/authz`, (2) validate with Zod, (3) write `ActivityLog` via `src/server/audit`, inside one Prisma transaction.
- `src/lib/` constants (departments, statuses, priorities), zod schemas, utils.
- `worker/` scheduled jobs. `scripts/` validate/smoke.

## Conventions
- Never trust client role/department; read from session.
- Ticket IDs: `KN-<DEPTCODE>-<YYYY>-<00001>` generated in a transaction.
- `originalDueDate` is never overwritten. Overdue is computed, not a status.
- Every AI output is stored with `source: "AI"` and cited ticket IDs; UI labels it "AI-generated".
- Dates stored UTC, displayed Asia/Kolkata.
- No test files for now (project decision). Validation = `pnpm validate` + story Validation steps.

## Commands
- `pnpm dev` app · `pnpm worker` jobs · `pnpm validate` typecheck+lint+build
- `pnpm db:reset` migrate + seed · `pnpm db:migrate` · `pnpm smoke` smoke checks
- Postgres: `docker compose up -d db`
- Seed logins: `<role>@kubera.local` / `Password@123` (see `prisma/seed.ts`)

## Definition of done (every story)
`pnpm validate` green · acceptance criteria met · story "Implementation notes" filled (≤6 lines) · `stories/BOARD.md` status updated.
