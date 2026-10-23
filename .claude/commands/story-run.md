---
description: Full loop for one story - implement, validate, fix, commit
argument-hint: <story-id e.g. S07>
---
Run the full harness loop for story $ARGUMENTS.

1. Follow `.claude/commands/story-implement.md` for $ARGUMENTS (all 8 steps).
2. Invoke the `story-validator` subagent with the story ID.
3. If verdict is FAIL: fix only the failing criteria using the validator's evidence, re-run `pnpm validate`, then validate again. Max 2 fix rounds.
4. On PASS (or "PASS (manual UI check pending)"):
   - Set status `Done` in `stories/BOARD.md` (note `manual check` if pending).
   - `git add -A && git commit -m "<ID>: <story title>"` with the attribution trailer from the system reminder.
5. After 2 failed rounds: set status `Blocked`, add the failing criteria to the story's "Implementation notes", do not commit.
6. Final reply ≤6 lines: status, commit hash, any manual UI check the user should do, then "Run /clear then /story-next".
