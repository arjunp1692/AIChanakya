# S12 — Ticket dependencies
model: sonnet · deps: S09 · PRD: FR-03, §8, §10 Cross-Department Intelligence

## Goal
Link tickets that wait on other tickets or on external prerequisites.

## Scope
- Add/remove dependency: another ticket (search by ID/title) or free-text external prerequisite; mark external resolved.
- Prevent self-dependency and cycles (DFS check).
- Ticket page: "Waiting on" and "Blocking" lists with status badges; unresolved dependency count on list rows.
- `src/server/tickets/dependencies.ts` `getDependencyGraph(filter)` — reused by AI bottleneck detection (S30).

## Acceptance criteria
1. Cycles (A→B→A) rejected.
2. Both directions displayed on each ticket.
3. Changes recorded in history.

## Validation
- tsx: create A→B, attempt B→A (rejected); fetch both ticket pages and grep for each other's IDs.

## Implementation notes
- `src/server/tickets/dependencies.ts`: `addDependency` (`{kind:"ticket",dependsOn:<ticketNo>}` | `{kind:"external",externalPrerequisite}`), `removeDependency`/`resolveDependency` (`{dependencyId}`), `searchDependencyTargets`. All need `ticket.edit` on the waiting ticket; target must be viewable. Add only on open tickets.
- Rejects self, duplicate, unknown/invisible target and cycles (`reaches()` walks ticket→ticket edges in the tx) → 400 `TicketInputError("dependsOn")`.
- Resolved = external `resolved` flag, or linked ticket in `CLOSED_STATUSES` (`isDependencyResolved` / SQL `unresolvedDependencyWhere`). List rows carry `_count.dependencies` (unresolved) → "Waiting on N" badge.
- Events: `DEPENDENCY_ADDED/REMOVED/RESOLVED` (field `dependency`, value = ticketNo or external text) on the waiting ticket, `DEPENDENT_ADDED/REMOVED` on the target; ActivityLog entity `TicketDependency`.
- **S30:** `getDependencyGraph({user?, departmentIds?, openOnly=true, unresolvedOnly?})` → `{nodes: Map<id, node>, edges: {fromId(waiting), toId|null, external, resolved}[]}`. Prisma gotcha: use `rel: { is: where }` (bare `{}` inside OR mismatches).
- UI: Dependencies card = "Waiting on"/"Blocking" with status badges, `AddDependencyForm` (datalist search) + `DependencyButton`. Check: `pnpm exec tsx .harness/tmp/s12-check.ts` (needs `pnpm dev` on :3000 for page fetch).
