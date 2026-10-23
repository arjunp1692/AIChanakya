# S36 — Launch readiness verification
model: opus · deps: all · PRD: §16, §14, §13 Phase 4 (pilot, training)

## Goal
Prove each PRD §16 launch condition with evidence, and fix only small gaps (open new stories for big ones).

## Scope
- `scripts/launch-check.ts` (`pnpm launch-check`) automating every checkable item:
  1. 8 departments, each with an active HOD.
  2. Every active ticket: unique ID, owner, status, dueDate or noDeadlineReason.
  3. HoD report links existing tickets (submit via service, assert no new ticket for linked rows).
  4. Co-assignee permission boundaries.
  5. Updates/deadline/completion in history.
  6. Overdue + critical blocker → escalation + notification (run jobs once).
  7. `pnpm reconcile` zero diffs.
  8. Every dashboard KPI drill-down count equals KPI value.
  9. Permission matrix spot checks + backup/restore done (S35 notes).
  10. AI outputs: every AiInsight has citations, source label and a review status; the card shows "Unreviewed" until reviewed.
- §14 KPIs: print the current values from S38 `computeKpis` as a table; the launch baseline period starts here.
- `docs/LAUNCH-CHECKLIST.md` with results and the date run.
- `docs/USER-GUIDE.md`: one short section per role (HoD: daily report; Member/co-assignee: updates and evidence; CEO: dashboard, decisions, escalations, AI review; CEO Office: admin, settings, compliance).
- `docs/PILOT.md`: pilot plan per PRD §13 Phase 4 (2–3 pilot departments, duration, training session agenda, feedback log, go/no-go criteria = this checklist + §14 targets, rollout order for the remaining departments).

## Acceptance criteria
1. `pnpm launch-check` prints 10/10 PASS (or lists failures with new follow-up stories in BOARD).
2. Checklist, user guide and pilot plan docs committed.

## Validation
- `pnpm db:reset && pnpm launch-check`.

## Implementation notes
_(implementer fills, ≤6 lines)_
