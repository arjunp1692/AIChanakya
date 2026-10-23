# S28 — AI service layer and guardrails
model: opus · deps: S23 · PRD: FR-07, §10 AI guardrails, §15 (misleading insights)

## Goal
One safe, cheap, grounded way to call Claude. AI can only read and suggest; it never mutates tickets.

## Scope
- `src/server/ai/client.ts`: `@anthropic-ai/sdk`; models from env (`AI_MODEL_ANALYSIS=claude-sonnet-5-5`, `AI_MODEL_FAST=claude-haiku-5-5`); prompt caching on the static system prompt; timeout + 1 retry; returns `null` and UI shows "AI unavailable" when `ANTHROPIC_API_KEY` is unset.
- `src/server/ai/context.ts`: builds **compact** JSON context from DB (ticketNo, title ≤80 chars, dept, owner name, status, priority, due/original due, extensions, blocker reason ≤120 chars, dependencies) — never raw full descriptions or confidential tickets unless the viewer may see them.
- Output contract (Zod-validated): `{ facts: [{text, ticketNos[]}], insights: [{text, ticketNos[], confidence: "pattern"|"hypothesis"}], recommendations: [{text, ticketNos[]}] }`. Reject/strip any item citing a ticketNo not present in the context.
- System prompt encodes PRD §10 guardrails (no invented progress, no blame without evidence, no deadline/status changes, no decisions).
- Persist to `AiInsight` with model, period, citedTicketNos. Shared UI component `<AiInsightCard>`: "AI-generated" badge, facts vs insights visually distinct, every ticketNo is a link.
- Log token usage per call in ActivityLog (cost tracking).
- Human validation (PRD §15): new insights are `UNREVIEWED`. The card shows an "Unreviewed" chip and, for `ai.review` users (CEO, CEO_OFFICE), "Mark reviewed" / "Dismiss" with an optional note → reviewedBy/At + ActivityLog. Dismissed insights are hidden by default; nothing is ever deleted.

## Acceptance criteria
1. Without API key the app works and AI panels show "AI unavailable".
2. An injected fake ticketNo in model output is stripped before saving.
3. AI module has no import of ticket mutation services (grep check).
4. Card visibly separates verified facts from AI insights.
5. Review/dismiss is recorded with reviewer and time; HOD/MEMBER/VIEWER get 403 on the review action.

## Validation
- Unit-style tsx script feeding a canned model response (with a bogus ticketNo) through the validator; `grep -r "tickets/service" src/server/ai` returns nothing; GET a page with AI card without key.

## Implementation notes
_(implementer fills, ≤6 lines)_
