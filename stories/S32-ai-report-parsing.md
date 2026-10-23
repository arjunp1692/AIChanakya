# S32 — AI-assisted report entry (P2)
model: sonnet · deps: S28, S17 · PRD: §7 (minimal reporting effort), §11 Usability

## Goal
An HoD can paste free text (e.g. from WhatsApp) and get pre-filled report rows to confirm.

## Scope
- "Paste notes" box on `/report` → Claude Haiku with the dept's open ticket list (ticketNo + title) → proposed rows: section, linked ticketNo (or new), status/progress, note, reason.
- Each proposed link is verified to exist in the dept list, and new-row titles run through `findSimilarTickets` (S17).
- Rows land in the form as **unsaved suggestions** with a highlight; the HoD edits/accepts; normal submit flow (S15) applies. Nothing is saved automatically.

## Acceptance criteria
1. Parsed rows are never submitted without the HoD pressing submit.
2. Invalid ticketNos from the model are dropped.
3. Without key the paste box is hidden.

## Validation
- With key: paste a sample text referencing 2 seeded tickets + 1 new task; check form state (manual) and that no DB rows were created before submit.

## Implementation notes
_(implementer fills, ≤6 lines)_
