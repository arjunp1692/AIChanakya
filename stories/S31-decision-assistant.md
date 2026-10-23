# S31 — CEO Decision Assistant
model: sonnet · deps: S28, S22 · PRD: §10 CEO Decision Assistant

## Goal
Each pending decision gets a crisp AI-drafted brief, and the CEO still decides.

## Scope
- On a decision page: "Draft brief" → Claude receives decision fields + linked ticket + its dependencies/blockers → summary, business impact, options with trade-offs, recommendation, responsible dept, deadline — all citing ticketNos. Stored as AiInsight(DECISION_DRAFT) linked to the decision.
- Shown in `<AiInsightCard>` beside the human-entered request; the CEO's decision form is unchanged (AI never pre-selects an option).

## Acceptance criteria
1. Draft is clearly labelled AI-generated and separate from the requester's recommendation.
2. Recording a decision never depends on the AI draft existing.
3. Without key: button disabled with "AI unavailable".

## Validation
- With key: generate draft for a seeded decision and inspect AiInsight row; without key: GET page and grep disabled state.

## Implementation notes
_(implementer fills, ≤6 lines)_
