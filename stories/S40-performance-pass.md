# S40 — Performance pass (dev + runtime)
model: sonnet · deps: S13 · PRD: §11 (NFR: responsive UI)

## Goal
The app feels fast locally and in production: no multi-second route compiles in dev, fewer round-trips and less JS per page.

## Baseline (2026-11-03, 46 tickets, CEO login, `.harness/tmp/s40-perf.ts`)
- Dev (webpack): first hit per route 1.1–1.5 s (on-demand compile); warm p50 `/` 157 ms, `/tickets` 420 ms, detail 299 ms.
- Prod (`next build && next start`): warm p50 `/` 20 ms, `/tickets` 54 ms, detail 42 ms. DB: `listTickets` 7 ms, `SELECT 1` 1 ms.
- First-load JS: `/tickets` 213 kB, `/forbidden` (static, one Button) 187 kB vs 102 kB shared.
- Conclusion: most of the felt slowness is the webpack dev compiler; DB is not the bottleneck.

## Scope
- Dev: `pnpm dev` uses Turbopack (`next dev --turbopack`); keep `pnpm dev:webpack` as fallback. Add `pnpm preview` (build + start) for realistic speed checks/demos.
- Bundle: `experimental.optimizePackageImports: ["radix-ui"]` (umbrella package isn't tree-shaken by default; lucide already is).
- Per-request dedupe with React `cache()`: `requireUser` (layout + page both call `auth()`), Setting reads (`completionPolicy`, `deadlineNeedsApproval`).
- Ticket detail page: run independent queries (policy, deadline approval, people/owners/name lookups) in parallel.
- `listTickets`: count and page rows in parallel (re-query only if the requested page is out of range).
- `src/lib/format.ts`: shared cached IST `Intl.DateTimeFormat` formatters; replace per-call `toLocale*String(…, {timeZone})` (~100× cheaper).
- `scripts/perf.ts` + `pnpm perf [baseUrl]`: logs in as CEO, prints first-hit and warm p50 for key pages.

Out of scope: caching data across requests, pagination of comments/events, DB index changes (queries are already ms-level).

## Acceptance criteria
1. Dev mode options measured and the faster one is the default (Turbopack evaluated, rejected on Windows); numbers recorded in Implementation notes.
2. First-load JS for `/forbidden` and `/tickets` is lower than baseline; prod warm p50 is no worse than baseline.
3. No behaviour change: same data, permissions and IST date output on list/detail pages.
4. `pnpm validate` green.

## Validation
- `pnpm perf` against `pnpm dev` and against `pnpm preview` (port 3000) before/after; compare build route table.
- Spot-check list + detail pages render the same dates/status options as before.

## Implementation notes
- Scripts: `pnpm dev:turbo` (opt-in), `pnpm preview` = build+start, `pnpm perf [baseUrl]` (`scripts/perf.ts`). `pnpm dev` stays webpack: on Windows Turbopack added ~300 ms to every warm request (health 36→340 ms, `/tickets` 395→515 ms), only cold compiles were faster.
- `optimizePackageImports: ["radix-ui"]`: first-load JS `/forbidden` 187→105 kB, `/tickets` 213→133 kB.
- `requireUser` and new `src/server/settings.ts#getSettingValue` wrapped in React `cache()`; workflow/deadline/service Setting reads go through it.
- `listTickets` runs count + rows in parallel (re-fetch only if page out of range); detail page runs policy/approval/user lookups in one `Promise.all`.
- `src/lib/format.ts`: cached IST formatters (`fmtDate`, `fmtDateTime`, `isoDateIST`), output identical to old `toLocale*`.
- Prod warm p50 after: `/` 21 ms, `/tickets` 41 ms (was 54), detail 45 ms. Dev warm is dominated by React dev-mode render (~170–400 ms) — use `pnpm preview` for real speed.
