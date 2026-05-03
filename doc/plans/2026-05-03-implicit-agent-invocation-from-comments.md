# Plan: Automated Implicit Agent Invocation from Issue Comments

## Problem

When an agent posts a comment on an issue and mentions another agent by name without using the `@` syntax, the referenced agent is not automatically woken up.

**Example**: Mark comments at 12:44 — "I reviewed the code. Carl needs to give us a detailed report on the performance impact." Mark did not write `@Carl`, so the existing `@-mention` parser (`findMentionedAgents`) does not detect Carl. Carl never gets invoked, creating a silent dependency drop.

## Current State

- `findMentionedAgents` in `server/src/services/issues.ts` detects explicit `@AgentName` and `@agent-id` mentions using regex `/\B@([^\s@,!?.]+)/g`.
- Mention wakeups happen in two route handlers:
  1. `PATCH /issues/:id` (issue update with comment) — lines 1262–1289
  2. `POST /issues/:id/comments` (standalone comment) — lines 1657–1683
- Both use `heartbeat.wakeup()` with `reason: "issue_comment_mentioned"`.
- There is **no** implicit reference detection.

## Goal

When a comment body contains an agent's name as a whole word, and the context suggests delegation or dependency, automatically wake that agent as if they had been `@-mentioned`.

## Design Decisions

### 1. Detection Strategy — Whole-Word Name Matching

- Build a set of all agent names for the company (already fetched by `findMentionedAgents`).
- For each agent name, test whether it appears as a **whole word** in the comment body (case-insensitive).
- A whole-word match means the name is surrounded by word boundaries (`\b`), so "Carl" in "Carla" does not match, and "Carl" in "de-carl-ize" does not match.
- **No action-verb heuristic for V1**. The simpler whole-word rule is safer and easier to reason about. Agents in the same company rarely mention each other casually; if Mark writes "Carl" in an issue comment, it is almost always intentional coordination.

### 2. Deduplication & Exclusion Rules

- Exclude agents already resolved by explicit `@-mentions` (avoid duplicate wakeups).
- Exclude the actor who posted the comment (agent talking about itself is usually status, not delegation).
- Exclude archived/paused/terminated agents (same as existing behavior — these are not invokable anyway, but filtering early is cleaner).

### 3. Wakeup Reason

- Use a new distinct reason: `issue_comment_referenced` (separate from `issue_comment_mentioned`).
- This allows operators to tell in logs and run context whether the wake was from an explicit `@` or an implicit name drop.

### 4. Integration Points

The implicit detection runs **immediately after** explicit mention detection in both route handlers, sharing the same `wakeups` map so deduplication is automatic.

## Implementation Steps

1. **Add `findReferencedAgents` to `issues.ts` service**
   - Accept `companyId`, `body`, `actorAgentId` (optional).
   - Reuse the agent-name fetch from `findMentionedAgents` (or refactor both to share a helper).
   - Return `string[]` of agent IDs that are implicitly referenced.

2. **Update `routes/issues.ts` — `PATCH /issues/:id`**
   - After the explicit mention block (line ~1289), add the implicit reference block.
   - Merge into the same `wakeups` map.

3. **Update `routes/issues.ts` — `POST /issues/:id/comments`**
   - After the explicit mention block (line ~1683), add the implicit reference block.
   - Merge into the same `wakeups` map.

4. **Add unit tests**
   - Test whole-word matching (matches "Carl", not "Carla").
   - Test case insensitivity.
   - Test exclusion of self and already-mentioned agents.
   - Test multiple implicit references in one comment.

5. **Verification**
   - `pnpm -r typecheck`
   - `pnpm test:run`

## Files to Modify

- `server/src/services/issues.ts` — add `findReferencedAgents`
- `server/src/routes/issues.ts` — wire implicit detection into both comment paths
- `server/src/__tests__/issues-service.test.ts` or new test file — add tests

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| False positives (agent name in unrelated text) | Whole-word matching + actor exclusion. If still noisy, add a deny-list or action-verb heuristic in V2. |
| Duplicate wakeups | Same `wakeups` Map deduplicates by agent ID; implicit run happens after explicit, so `wakeups.has(id)` skips. |
| Performance (regex per agent name) | Agent counts per company are small (< 100). Regex compilation is trivial. |

## Future Extensions (V2)

- Action-verb heuristics: only wake when agent name is near verbs like "needs to", "should", "will", "must", "please".
- LLM-based dependency extraction for complex references ("the infrastructure team" → maps to infra agent).
- Configurable per-company toggle to disable implicit invocation.
