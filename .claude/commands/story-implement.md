---
description: Implement one story (no validation handoff)
argument-hint: <story-id e.g. S07>
---
Implement story $ARGUMENTS.

1. Open the matching file `stories/$ARGUMENTS-*.md`. Check every dependency in `stories/BOARD.md` is `Done`; if not, stop and say which.
2. Read only what CLAUDE.md "Token rules" allows: this story, files it lists, and the "Implementation notes" section of dependency stories.
3. Set the story status to `In Progress` in `stories/BOARD.md`.
4. Implement exactly the Scope. Out-of-scope ideas go in the story's notes as "Follow-ups", not into code.
5. Run `pnpm validate` (skip only for S01 before package.json exists). Fix until green. If the story changes the schema, run `pnpm db:reset`.
6. Run the story's Validation steps yourself once. Extend `scripts/smoke.ts` if the story says so.
7. Fill "Implementation notes" in the story file (≤6 lines: key files, decisions, anything later stories must know).
8. Reply with ≤5 lines: what changed, validate result, anything needing a human decision. Do not commit.
