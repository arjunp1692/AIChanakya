# Chanakya AI — Implementation Plan

Source: [PRD.md](PRD.md) (copy of `ChanakyaAIPRD.docx`). Stories: [../stories/BOARD.md](../stories/BOARD.md).

## 1. Assumed answers to PRD §17 (CEO decisions)

Everything below is configurable in Settings, so a different answer later is a config change, not a rewrite.

**Status: assumed, not yet confirmed by the CEO.** Confirm before S02/S04 are implemented.

| Decision | Assumed default |
|---|---|
| Implementation approach | Custom web application |
| Notification channel | In-app + email. WhatsApp is an adapter slot for later |
| Daily report cut-off | 7:00 PM IST (configurable) |
| Completion validation | Owner marks complete; HoD validation required for Critical/High tickets (configurable per priority) |
| Cross-department visibility | Hybrid: own department + tickets you are assigned to or that depend on yours; CEO/CEO Office/Viewer see all; HR tickets flagged confidential are restricted |

## 2. Tech stack

One TypeScript monolith with Postgres. One language, one repo and one database keep the context the AI needs per story small, so each story costs fewer tokens.

| Layer (PRD §12) | Choice | Why |
|---|---|---|
| UI | Next.js (App Router, latest stable) + React + Tailwind CSS + shadcn/ui | Server components and server actions mean no separate API project; shadcn is copy-in components the AI already knows well |
| Tables / charts | TanStack Table, Recharts | Drill-down lists, KPI charts |
| Forms / validation | React Hook Form + Zod | The same Zod schema validates on client and server |
| API / business rules | Server Actions + Route Handlers under `src/server/*` services | Rules live in plain TS services, and UI stays thin |
| Auth | Auth.js (credentials now; Google/Microsoft SSO later) | Session carries role + department |
| Permissions | Own `can(user, action, resource)` policy module | One place to audit (FR-08) |
| Database | PostgreSQL 16 + Prisma ORM | Relational data model with audit logs; `pg_trgm` handles duplicate detection |
| Workflow jobs | pg-boss (job queue in Postgres) running in a `worker` process | Reminders, escalations, weekly snapshots with no Redis |
| Real-time | Server-Sent Events + Postgres `LISTEN/NOTIFY` | Push updates (FR-04) without a websocket server |
| Notifications | In-app table + Nodemailer (SMTP) / Resend; console transport in dev | Channel adapters |
| Files / evidence | Local `uploads/` in dev, S3-compatible in prod behind a `storage` interface | |
| Exports | `exceljs` (CSV/XLSX), `@react-pdf/renderer` (PDF) | NFR Export |
| AI | Anthropic Claude API (`@anthropic-ai/sdk`): `claude-sonnet-5-5` for briefs and analysis, `claude-haiku-5-5` for parsing; prompt caching; JSON output that cites ticket IDs | FR-07; AI is optional, and the app works without a key |
| Dev / deploy | Node 22 LTS, pnpm, Docker Compose (Postgres + app + worker) | Runs on Windows (Docker Desktop) and Linux servers |

**Folder layout** (enforced in `CLAUDE.md`):
```
prisma/            schema.prisma, seed.ts
src/app/           routes (UI) — thin
src/server/        services: tickets, reports, metrics, escalations, decisions, ai, audit, authz, notify
src/lib/           shared utils, zod schemas, constants (statuses, priorities, departments)
src/components/    UI components (shadcn in components/ui)
worker/            pg-boss jobs
scripts/           validate + smoke scripts
```

## 3. Delivery phases (map to PRD §13)

| Phase | Stories | Outcome you can see working |
|---|---|---|
| A. Foundation | S01–S05 | Login as each role and see a role-specific menu. 8 departments are seeded and audit logging works |
| B. Ticket core (FR-01/03/04/08) | S06–S13 | Create, assign, update, block and complete tickets, with co-assignees, dependencies, evidence and history |
| C. Daily reporting (FR-02) | S14–S17 | HoD submits EOD report → tickets created/updated, carry-forward, missing-report detection |
| D. Alerts and decisions (FR-05) | S18–S22 | Live updates, in-app/email notifications, escalation engine, CEO decision register |
| E. CEO dashboard (FR-06) | S23–S27, S38 | Command Centre with correct cohort metrics, drill-down, scorecards, weekly snapshot, exports, §14 KPI tracking |
| F. AI layer (FR-07) | S28–S32, S37 | Daily brief, delay patterns, bottlenecks, decision assistant, inconsistent-update flags, all citing tickets |
| G. Launch | S33–S36 | Admin settings, mobile pass, backup/restore, PRD §16 launch checklist verified |

The ticket core and reporting phases come before AI, as PRD §17's final definition says.

## 4. Development process (AI harness)

### The loop (one story per session)
```
/story-next             → picks the first story whose deps are all Done
/story-run S07          → implement → validate → fix (≤2 rounds) → update board → commit
/clear                  → fresh context before the next story
```
Run the steps by hand if you want to review in between:
```
/story-implement S07    → code + `pnpm validate` green + "Implementation notes" written
/story-validate S07     → story-validator subagent (fresh context, read-only) returns PASS/FAIL per acceptance criterion
```

### Pieces of the harness
| File | Role |
|---|---|
| `CLAUDE.md` | Short standing rules: stack, layout, commands, conventions, token rules |
| `docs/PRD.md` | Reference only. Stories cite `PRD §N`, and agents grep that section instead of reading the whole file |
| `stories/BOARD.md` | Status board: ID, title, deps, status |
| `stories/Sxx-*.md` | One story = complete context contract: goal, PRD refs, scope, acceptance criteria, validation steps |
| `.claude/commands/story-*.md` | The slash commands above |
| `.claude/agents/story-validator.md` | Independent validator; cannot edit code |
| `pnpm validate` | typecheck + lint + build (added in S01) |
| `scripts/smoke.ts` | Small HTTP/DB smoke checks the validator extends per story (these are runnable checks, not a test suite) |

### Validation without a test suite
Each story has a **Validation** section with concrete, runnable checks:
1. **Static:** `pnpm validate` must pass. This is the gate on every story.
2. **Data:** `pnpm db:reset` (migrate + seed) runs clean.
3. **Behaviour:** the validator starts the app, then uses curl, smoke-script calls or a DB query to prove each acceptance criterion (e.g. "submitting a report twice for the same date creates a revision, not a second report").
4. **Visual (UI stories):** the validator opens the page in the browser tool if one is available. Otherwise the story is marked `PASS (manual UI check pending)` and lists what you should click.

The validator reports each criterion as PASS or FAIL with evidence. A FAIL goes back to the implementer with exact findings. After 2 failed rounds the story is marked Blocked for you to look at.

### Token efficiency rules
- **One story per session, then `/clear`.** Context stays small and reads stay cached.
- **The story file is the only required read.** It names the PRD sections and files to touch, and agents don't explore the repo broadly.
- **Each story stays small:** 1 vertical slice, usually under ~400 changed lines. Split anything bigger.
- **Model routing:** Sonnet implements by default. Stories tagged `model: opus` (metrics, escalation engine, permissions) use Opus. The validator runs on Sonnet.
- **No re-deriving:** each story ends with 3–6 lines of Implementation notes (files, decisions), and later stories read only those notes from their deps.
- **Commit after every passing story,** so a bad story is one `git revert` away.

## 5. Reporting rules (decided in this plan; PRD §6 says they must be explicit)
- **Cohort** = tickets created in the period, excluding Cancelled and Duplicate. Completed % and Pending % both use this cohort.
- **Completed (in period)** = tickets whose completion timestamp falls in the period, any cohort. Shown separately from cohort completion.
- **Carried forward** = open tickets created before the period.
- **Delayed** = open and `now > dueDate` (effective due date from status history), never from a self-reported label.
- **Reopened** tickets count as open again. Their first completion stays in history, and on-time is measured on the final completion.
- **Cancelled** tickets are excluded from cohort and rates and counted separately. **Duplicates** are linked to the original and excluded everywhere.
- **Repeated delay** = a ticket with ≥2 due-date extensions or ≥2 overdue episodes (threshold configurable).
