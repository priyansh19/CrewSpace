# CrewSpace GitHub Issues Draft
> Review each issue below. Once confirmed, these will be created on GitHub with labels, descriptions, and proper formatting.
> Total: 35 issues across 8 categories.

---

## CATEGORY 1: UI Stability & Polish (7 issues)

---

### ISSUE 1
**Title:** `[UI] Add global error boundary to prevent full-app crashes on component errors`
**Labels:** `bug`, `ui`, `stability`

**Description:**
Currently, if any React component throws an unhandled exception during render, the entire application crashes with a blank screen and no user-facing recovery path.

**Problem:**
- No `ErrorBoundary` component wrapping route-level pages
- Streaming SSE errors (chat, heartbeat) can bubble up and break the layout
- User loses unsaved form state on crash with no explanation

**Proposed Solution:**
- Add a top-level `ErrorBoundary` in `ui/src/App.tsx` that renders a friendly fallback UI with a "Reload" button
- Add per-page `ErrorBoundary` wrappers in `ui/src/pages/` to isolate crashes to individual routes
- Log errors to the server via `POST /api/activity` for observability
- Add a route-level Suspense boundary for lazy-loaded pages

**Acceptance Criteria:**
- [ ] Throwing inside any page component shows an error card, not a blank screen
- [ ] Error card includes: error summary, "Go to Dashboard" and "Reload Page" buttons
- [ ] Error details sent to server log
- [ ] Existing Playwright E2E tests still pass

**References:** `ui/src/App.tsx`, `ui/src/pages/`

---

### ISSUE 2
**Title:** `[UI] Kanban board flickers on drag-and-drop when optimistic update reverts`
**Labels:** `bug`, `ui`, `kanban`

**Description:**
When a user drags a card to a new column on the Issues kanban board, there is a visible flicker if the API call to update the issue status fails or takes > 300ms, because the optimistic state is applied before the server confirms the move.

**Problem:**
- `dnd-kit` `onDragEnd` applies local state immediately, but React Query refetch overwrites it before the mutation settles
- No pending/loading visual on the card being dragged
- On network failure, the card "jumps back" with no toast explaining why

**Proposed Solution:**
- Wrap the status mutation in React Query `useMutation` with `onMutate` / `onError` / `onSettled` handlers for proper optimistic update lifecycle
- Show a subtle loading spinner on the card while the mutation is in-flight
- Toast the user on failure: "Couldn't move card — please try again"

**Acceptance Criteria:**
- [ ] Card stays in target column visually until server responds
- [ ] On failure, card smoothly returns to original column
- [ ] Toast appears on failure
- [ ] No flicker visible when mutation succeeds within 500ms

**References:** `ui/src/pages/Issues.tsx`

---

### ISSUE 3
**Title:** `[UI] Re-enable worktree support UI once workflow is ready`
**Labels:** `enhancement`, `ui`, `worktrees`

**Description:**
The issue worktree UI is currently disabled behind a `TODO` comment:
```tsx
// TODO(issue-worktree-support): re-enable UI once workflow ready to ship
```
in `ui/src/adapters/runtime-json-fields.tsx`.

**Problem:**
- Worktree isolation is a critical developer-workflow feature (each task gets its own git worktree)
- The backend supports it (`execution-workspaces` routes exist) but the UI exposes no controls
- Users have no way to configure or trigger worktree creation from the UI

**Proposed Solution:**
- Audit `execution-workspaces` API to confirm all required endpoints are stable
- Re-enable the UI toggle in `runtime-json-fields.tsx`
- Add a "Worktree" tab on `IssueDetail.tsx` showing the active workspace path, status, and a "Open in IDE" deep link
- Add worktree lifecycle buttons: Create, Attach, Detach, Delete

**Acceptance Criteria:**
- [ ] Worktree UI visible on issue detail page when the adapter supports it
- [ ] Create/delete worktree from UI works end-to-end
- [ ] E2E test covers the worktree creation flow

**References:** `ui/src/adapters/runtime-json-fields.tsx`, `server/src/routes/execution-workspaces.ts`

---

### ISSUE 4
**Title:** `[UI] 3D Office page has no loading state — shows blank canvas on slow connections`
**Labels:** `bug`, `ui`, `performance`, `3d-office`

**Description:**
The 3D Office page (`pages/Office.tsx`) renders a React Three Fiber canvas immediately but loads agent position data asynchronously. On slow connections or cold cache, the canvas appears blank or partially rendered for several seconds with no feedback.

**Problem:**
- No Suspense or skeleton loader for the 3D canvas
- Three.js assets (geometry, materials) load sequentially, causing pop-in
- No error state if agent data fetch fails

**Proposed Solution:**
- Wrap the canvas in a `<Suspense>` with a styled loading overlay (`Loading office...` spinner)
- Preload agent data before mounting the canvas using React Query's `prefetchQuery`
- Add an error boundary specifically for the Three.js canvas that falls back to a 2D flat org-chart view

**Acceptance Criteria:**
- [ ] Loading spinner visible while assets initialize
- [ ] No blank canvas flash
- [ ] Graceful fallback if WebGL is unavailable or canvas errors

**References:** `ui/src/pages/Office.tsx`

---

### ISSUE 5
**Title:** `[UI] Add pagination or virtual scrolling to Activity Log and Issues list`
**Labels:** `performance`, `ui`, `scalability`

**Description:**
The Activity Log (`pages/Activity.tsx`) and Issues board (`pages/Issues.tsx`) currently fetch all records in a single API call. As data grows, this causes slow initial load and high memory usage in the browser.

**Problem:**
- `GET /api/activity` returns all records without limit by default
- `GET /api/companies/:id/issues` loads all statuses in one payload
- At 10,000+ records, the browser tab can become unresponsive

**Proposed Solution:**
- Add cursor-based pagination to `/api/activity` and `/api/issues` (query params: `cursor`, `limit`)
- Implement `useInfiniteQuery` in the UI for both pages
- Add an infinite scroll trigger at the bottom of each list
- For the kanban board, lazy-load each column independently

**Acceptance Criteria:**
- [ ] Activity log loads first 50 items, loads more on scroll
- [ ] Kanban columns each load 20 cards, load more on scroll
- [ ] Total API response times < 200ms for paginated requests
- [ ] Server `GET /api/activity` and `GET /api/issues` accept `cursor` and `limit` params

**References:** `server/src/routes/activity.ts`, `server/src/routes/issues.ts`, `ui/src/pages/Activity.tsx`, `ui/src/pages/Issues.tsx`

---

### ISSUE 6
**Title:** `[UI] Skills view missing from Agent Detail page`
**Labels:** `bug`, `ui`, `agents`

**Description:**
The Agent Detail page previously had a Skills tab that was removed with a TODO comment:
```tsx
// TODO: bring back skills view later
```
in `ui/src/pages/AgentDetail.tsx`. This leaves users with no way to view or modify an individual agent's skills from the agent profile.

**Proposed Solution:**
- Restore the Skills tab on the Agent Detail page
- Fetch per-agent skills from `GET /api/companies/:id/skills` filtered by agent
- Allow toggling individual skills on/off per agent with optimistic updates
- Show a badge count on the tab ("5 skills enabled")

**Acceptance Criteria:**
- [ ] Skills tab visible on Agent Detail page
- [ ] Skills can be toggled per-agent from the UI
- [ ] Changes persist correctly and reflect on the Company Skills page

**References:** `ui/src/pages/AgentDetail.tsx`, `server/src/routes/company-skills.ts`

---

### ISSUE 7
**Title:** `[UI] Add mobile-responsive layout for dashboard and kanban board`
**Labels:** `enhancement`, `ui`, `responsive`

**Description:**
CrewSpace UI is entirely desktop-first. On mobile viewports (< 768px), the sidebar overlaps content, the kanban board columns stack incorrectly, and many dialogs overflow the screen.

**Problem:**
- Sidebar uses fixed pixel widths with no breakpoint collapse
- Kanban board uses a horizontal flex layout incompatible with narrow viewports
- Modals and dialogs lack max-height constraints, causing overflow on small screens

**Proposed Solution:**
- Add a collapsible hamburger sidebar for mobile viewports using Tailwind `md:` breakpoints
- Convert kanban columns to a vertically scrollable card stack on mobile
- Add `max-h-[90vh] overflow-y-auto` to all dialog content areas
- Test with Chrome DevTools mobile emulation (iPhone 14 Pro, Pixel 7)

**Acceptance Criteria:**
- [ ] App is usable on 375px wide viewport
- [ ] Sidebar collapses to a hamburger menu on mobile
- [ ] Kanban board scrolls vertically on mobile
- [ ] No horizontal overflow on any page at 375px

---

## CATEGORY 2: E2E Testing & Test Coverage (6 issues)

---

### ISSUE 8
**Title:** `[Testing] Expand E2E test suite — cover core agent workflow end-to-end`
**Labels:** `testing`, `e2e`, `priority`

**Description:**
The current E2E suite covers only the onboarding wizard (`onboarding.spec.ts`) and Docker auth flow (`docker-auth-onboarding.spec.ts`). All critical user journeys after onboarding are untested.

**Proposed Coverage (new spec files):**
- `agent-lifecycle.spec.ts` — Create agent → configure adapter → run heartbeat → verify output
- `kanban-workflow.spec.ts` — Create issue → assign to agent → move through columns → close
- `agent-chat.spec.ts` — Open chat with agent → send message → receive streamed reply
- `approvals.spec.ts` — Trigger approval gate → review → approve/reject → verify issue unblocked
- `cost-governance.spec.ts` — Set budget → run agent → verify cost tracked → hit limit → verify agent stops

**Acceptance Criteria:**
- [ ] 5 new spec files added under `tests/e2e/`
- [ ] All specs pass in headless Chromium
- [ ] Added to `e2e.yml` GitHub Actions workflow
- [ ] Each spec has `CREWSPACE_E2E_SKIP_LLM=true` guard for CI (mock LLM responses)

**References:** `tests/e2e/`, `playwright.config.ts`, `.github/workflows/e2e.yml`

---

### ISSUE 9
**Title:** `[Testing] Add Vitest unit tests for server service layer (heartbeat, routines, costs)`
**Labels:** `testing`, `unit-tests`, `backend`

**Description:**
The three most complex and business-critical server services — `heartbeat.ts`, `routines.ts`, and `costs.ts` — have zero unit test coverage. Bugs in these services silently cause agents to double-execute tasks, miss budget limits, or drop routine runs.

**Proposed Tests:**
- `heartbeat.test.ts` — Test invocation scheduling, retry logic, concurrent guard
- `routines.test.ts` — Test queue/drop/catch-up policies, cron expression parsing
- `costs.test.ts` — Test budget enforcement, atomic deduction, overage detection

**Acceptance Criteria:**
- [ ] ≥ 80% line coverage on each of the three service files
- [ ] Tests use Vitest + mocked Drizzle client (no real DB required)
- [ ] Tests run in < 10 seconds total
- [ ] Added to `pnpm test:run` script

**References:** `server/src/services/heartbeat.ts`, `server/src/services/routines.ts`, `server/src/services/costs.ts`

---

### ISSUE 10
**Title:** `[Testing] Add E2E tests for plugin installation and lifecycle`
**Labels:** `testing`, `e2e`, `plugins`

**Description:**
The plugin system has no automated test coverage. Plugin install, enable/disable, and UI rendering are completely untested in CI, making plugin regressions invisible until users report them.

**Proposed Coverage:**
- `plugin-install.spec.ts`:
  - Navigate to Plugin Manager
  - Install an example plugin from `packages/plugins/examples/`
  - Verify plugin appears in sidebar
  - Enable → Disable → Re-enable
  - Uninstall and verify removed
- `plugin-ui.spec.ts`:
  - Install a plugin that registers a UI slot
  - Verify the slot renders in the correct location (dashboard, sidebar, entity extension)

**Acceptance Criteria:**
- [ ] 2 new spec files added under `tests/e2e/`
- [ ] Uses the example plugin from `packages/plugins/examples/`
- [ ] All plugin state transitions verified via API assertions
- [ ] CI green on all platforms

**References:** `tests/e2e/`, `packages/plugins/examples/`, `server/src/routes/plugins.ts`

---

### ISSUE 11
**Title:** `[Testing] Add multi-company isolation integration tests`
**Labels:** `testing`, `security`, `multi-company`

**Description:**
Company data isolation is a core security property — agents, issues, memories, and secrets from Company A must never be accessible from Company B. This property is currently only tested manually.

**Proposed Tests:**
- Create two companies (A and B) in a single test run
- Verify `GET /api/companies/:idA/agents` does not return Company B agents
- Verify `GET /api/companies/:idA/issues` does not return Company B issues
- Verify a Company A agent cannot read Company B secrets via API
- Verify company deletion of A does not affect B's data

**Acceptance Criteria:**
- [ ] Test file `tests/integration/multi-company-isolation.test.ts`
- [ ] Uses real Postgres (via embedded instance in test environment)
- [ ] All isolation assertions pass
- [ ] Runs as part of `pnpm test:run`

**References:** `server/src/services/agents.ts`, `server/src/routes/companies.ts`

---

### ISSUE 12
**Title:** `[Testing] Set up visual regression testing with Playwright screenshots`
**Labels:** `testing`, `visual-regression`, `ui`

**Description:**
UI regressions (broken layouts, missing components, style changes) are currently only caught by human review of PRs. Visual regression testing would automatically flag pixel-level differences.

**Proposed Solution:**
- Use Playwright's built-in `toHaveScreenshot()` assertions
- Add baseline screenshots for key pages: Dashboard, Issues board, Agent Detail, 3D Office
- Run visual diffs in CI on PRs (`pr.yml`)
- Store baseline images in `tests/visual-baselines/` and update with `--update-snapshots` flag

**Acceptance Criteria:**
- [ ] Baseline screenshots committed for 6+ key pages
- [ ] Visual diff step added to `pr.yml` (allowed to fail on first PR, require manual baseline approval)
- [ ] Diff artifacts uploaded to GitHub Actions on failure
- [ ] Documented in `CONTRIBUTING.md` how to update baselines

**References:** `tests/e2e/`, `.github/workflows/pr.yml`

---

### ISSUE 13
**Title:** `[Testing] Add load test to validate performance at 100+ concurrent agents`
**Labels:** `testing`, `performance`, `scalability`

**Description:**
CrewSpace has no load testing. At 100+ concurrent agents each firing heartbeats on 30s intervals, the server and database may hit connection pool limits, lock contention, or OOM conditions.

**Proposed Solution:**
- Use `k6` or `artillery` to simulate 100 concurrent agents sending heartbeat events
- Test `POST /api/heartbeat-runs` and `GET /api/issues` under load
- Measure P95 response time, error rate, and database connection pool utilization
- Target: P95 < 500ms, error rate < 0.1% at 100 concurrent agents

**Acceptance Criteria:**
- [ ] Load test script at `tests/load/heartbeat-load.js`
- [ ] Baseline report documented in `tests/load/README.md`
- [ ] No OOM crashes during 5-minute sustained load
- [ ] Database connection pool configuration documented

---

## CATEGORY 3: Backend Reliability (6 issues)

---

### ISSUE 14
**Title:** `[Backend] Hash agent API keys at rest — currently stored in plaintext`
**Labels:** `security`, `backend`, `critical`

**Description:**
Agent API keys stored in the `agent_api_keys` database table are currently saved as plaintext. If the database is compromised, all agent API keys are immediately exposed with no additional protection layer.

**Problem:**
- `INSERT INTO agent_api_keys (key, ...)` stores raw key value
- No hashing or encryption applied to the key column
- Exposed keys could allow unauthorized agent impersonation

**Proposed Solution:**
- Hash keys with `bcrypt` (cost factor 12) or `argon2id` on creation
- Store only the hash; return the plaintext key once at creation time (never again)
- Implement `compare(providedKey, storedHash)` in the auth middleware
- Add a migration to mark existing keys as invalidated (they cannot be rehashed)
- Document the key rotation process in the admin guide

**Acceptance Criteria:**
- [ ] New agent API keys stored as `argon2id` hashes
- [ ] Auth middleware uses hash comparison
- [ ] Existing keys invalidated with a migration warning
- [ ] Unit test for key creation and validation

**References:** `server/src/services/`, `packages/db/src/schema/`

---

### ISSUE 15
**Title:** `[Backend] Add rate limiting to public API endpoints`
**Labels:** `security`, `backend`, `stability`

**Description:**
All API routes are currently unprotected from abuse — a malicious client can send thousands of requests per second to `/api/auth`, `/api/companies`, or `/api/heartbeat-runs`, causing denial of service or database overload.

**Proposed Solution:**
- Add `express-rate-limit` middleware to Express app
- Tiers:
  - Auth routes (`/api/auth/*`): 10 requests / minute / IP
  - General API: 300 requests / minute / user
  - Heartbeat invocation: 60 requests / minute / agent
- Return `429 Too Many Requests` with `Retry-After` header
- Configurable limits via `instance-settings`

**Acceptance Criteria:**
- [ ] Rate limiting middleware applied globally
- [ ] Auth endpoint enforces strictest limits
- [ ] `429` response with `Retry-After` header returned on limit
- [ ] Rate limit thresholds configurable without code changes

**References:** `server/src/index.ts`, `server/src/routes/`

---

### ISSUE 16
**Title:** `[Backend] Improve error handling in SSE streaming handlers`
**Labels:** `bug`, `backend`, `reliability`

**Description:**
SSE (Server-Sent Events) streaming handlers for agent chat and heartbeat run logs have minimal error handling. If the underlying service throws, the stream silently terminates without informing the client, leaving the UI in an indefinite loading state.

**Problem:**
- `try/catch` missing around stream write operations
- No `event: error` SSE event type used to signal failures
- Client-side code has no timeout to detect a stalled stream
- Network disconnects during streaming are not cleaned up server-side (potential memory leak)

**Proposed Solution:**
- Wrap all SSE write operations in `try/catch`; send `event: error\ndata: {...}\n\n` on failure
- Add `req.on('close', cleanup)` to every SSE handler to abort underlying operations on disconnect
- Add a 30-second keepalive `event: ping` to prevent proxy timeouts
- Client-side: add a `EventSource` error handler that shows a "Stream disconnected — retry?" UI

**Acceptance Criteria:**
- [ ] All SSE handlers have disconnect cleanup
- [ ] Error events sent to client on failure
- [ ] Keepalive ping every 30 seconds
- [ ] Unit test for disconnect cleanup logic

**References:** `server/src/routes/heartbeat-runs.ts`, `server/src/routes/agents.ts`

---

### ISSUE 17
**Title:** `[Backend] Add database connection pool monitoring and health check`
**Labels:** `reliability`, `backend`, `observability`

**Description:**
The PostgreSQL connection pool (via Drizzle/pg) has no monitoring. Connection exhaustion causes all API requests to hang indefinitely rather than returning a meaningful error.

**Proposed Solution:**
- Expose pool stats (total, idle, waiting) in `GET /api/health` response
- Add a circuit breaker: if pool waiting > 80% of max size, return `503 Service Unavailable` immediately
- Log pool exhaustion events via Pino at `error` level
- Add pool config to `instance-settings` (max connections, acquire timeout)

**Acceptance Criteria:**
- [ ] `GET /api/health` includes `db.pool.total`, `db.pool.idle`, `db.pool.waiting`
- [ ] 503 returned when pool is exhausted
- [ ] Pool exhaustion logged at `error` level
- [ ] Max pool size configurable via instance settings

**References:** `server/src/index.ts`, `server/src/routes/health.ts`, `packages/db/src/client.ts`

---

### ISSUE 18
**Title:** `[Backend] Implement idempotent task checkout to prevent double-execution`
**Labels:** `reliability`, `backend`, `agents`, `critical`

**Description:**
The current task checkout mechanism (`POST /api/issues/:id/checkout`) uses a database row lock to prevent double-assignment. However, if the lock is held during a heartbeat crash and not released, the task becomes permanently stuck in a "checked-out" state with no timeout.

**Problem:**
- Checkout locks have no expiry — a crashed agent permanently blocks a task
- No background job to reclaim stale locks
- No visibility into how long a task has been locked

**Proposed Solution:**
- Add `checkedOutAt` and `checkoutExpiresAt` columns to `issues` table (migration required)
- Default checkout TTL: 2 hours (configurable per agent)
- Add a background sweeper (runs every 5 minutes) that reclaims expired locks and marks issues back to `in_progress` with an activity log entry
- Surface lock expiry on `IssueDetail.tsx` UI: "Checked out by Agent X — expires in 47 minutes"

**Acceptance Criteria:**
- [ ] `checkoutExpiresAt` column added via migration
- [ ] Background sweeper reclaims expired locks
- [ ] UI shows checkout expiry
- [ ] Unit test for expiry logic
- [ ] Integration test for sweeper reclaim

**References:** `server/src/routes/issues.ts`, `server/src/services/agents.ts`, `packages/db/src/schema/`

---

### ISSUE 19
**Title:** `[Backend] Add structured request/response logging with correlation IDs`
**Labels:** `observability`, `backend`, `developer-experience`

**Description:**
Server logs via Pino record HTTP requests but do not include correlation IDs. When debugging a multi-step agent execution (heartbeat → task checkout → LLM call → cost event), there is no way to trace all log lines for a single logical operation.

**Proposed Solution:**
- Generate a `X-Request-ID` header (UUID) for every incoming request (if not already present)
- Pass this ID as `requestId` to all Pino log calls via `child()` logger
- Propagate the ID to downstream LLM adapter calls via HTTP header
- Return `X-Request-ID` in all API responses for client-side debugging
- Add `requestId` to all activity log entries

**Acceptance Criteria:**
- [ ] Every request has a unique `requestId` in all log lines
- [ ] `X-Request-ID` returned in response headers
- [ ] Activity log entries include `requestId`
- [ ] Grep-able: `grep requestId=abc123 server.log` returns all lines for that request

**References:** `server/src/middleware/logger.ts`, `server/src/services/activity-log.ts`

---

## CATEGORY 4: Performance & Scalability (4 issues)

---

### ISSUE 20
**Title:** `[Performance] Add query indices for activity log, heartbeat runs, and cost events`
**Labels:** `performance`, `database`, `scalability`

**Description:**
High-frequency tables — `activity_log`, `heartbeat_runs`, and `cost_events` — grow unboundedly and are queried heavily. Without proper indices, queries slow down significantly after ~50,000 rows.

**Current State:**
- `activity_log` has no index on `(company_id, created_at)` — full table scan on every page load
- `heartbeat_runs` has no index on `(agent_id, created_at)` — agent history queries slow
- `cost_events` has no index on `(company_id, period_start)` — billing dashboard slow

**Proposed Solution:**
- Add composite indices via Drizzle migration:
  ```sql
  CREATE INDEX idx_activity_log_company_created ON activity_log(company_id, created_at DESC);
  CREATE INDEX idx_heartbeat_runs_agent_created ON heartbeat_runs(agent_id, created_at DESC);
  CREATE INDEX idx_cost_events_company_period ON cost_events(company_id, period_start DESC);
  ```
- Add `EXPLAIN ANALYZE` output for key queries to `docs/` as a performance baseline

**Acceptance Criteria:**
- [ ] 3 migrations adding the indices
- [ ] P95 query time for activity log < 50ms at 100,000 rows
- [ ] No full table scans on above queries

**References:** `packages/db/src/migrations/`, `server/src/routes/activity.ts`, `server/src/routes/costs.ts`

---

### ISSUE 21
**Title:** `[Performance] Implement server-side caching for dashboard summary and org chart`
**Labels:** `performance`, `backend`, `caching`

**Description:**
`GET /api/dashboard/summary` and `GET /api/companies/:id/org-chart.svg` recompute expensive aggregations on every request with no caching. Dashboard load times degrade as the number of agents and issues grows.

**Proposed Solution:**
- Add in-memory LRU cache (`lru-cache` package) with:
  - Dashboard summary: 30-second TTL per company
  - Org chart SVG: 60-second TTL per company
- Invalidate cache on relevant mutations (agent CRUD, issue status change)
- Add `Cache-Control: max-age=30` headers to these responses
- Expose cache hit/miss rate in `GET /api/health`

**Acceptance Criteria:**
- [ ] Dashboard summary served from cache after first request
- [ ] Cache invalidated when agents or issues change
- [ ] Cache stats in `/api/health`
- [ ] P95 dashboard load < 100ms with warm cache

**References:** `server/src/routes/dashboard.ts`, `server/src/routes/org-chart-svg.ts`

---

### ISSUE 22
**Title:** `[Performance] Lazy-load the 3D Office page assets to reduce initial bundle size`
**Labels:** `performance`, `ui`, `bundle-size`

**Description:**
Three.js (`@react-three/fiber`, `@react-three/drei`) adds ~800KB to the initial JavaScript bundle, increasing TTI (Time to Interactive) for all users — even those who never visit the 3D Office page.

**Proposed Solution:**
- Convert the Office page import to `React.lazy(() => import('./pages/Office'))`
- Add a route-level `Suspense` wrapper in the router
- Move Three.js and Drei to a separate dynamic chunk via Vite `manualChunks`
- Verify bundle size reduction with `vite-bundle-visualizer`

**Acceptance Criteria:**
- [ ] Initial JS bundle reduced by ≥ 500KB
- [ ] 3D Office page still loads and functions correctly
- [ ] Lighthouse Performance score on Dashboard page improves
- [ ] No Three.js code in the initial bundle (verified via bundle analyzer)

**References:** `ui/src/App.tsx`, `ui/vite.config.ts`, `ui/src/pages/Office.tsx`

---

### ISSUE 23
**Title:** `[Performance] Add agent memory vector search using pgvector`
**Labels:** `enhancement`, `performance`, `ai`, `memory`

**Description:**
Agent memory RAG search currently performs a full text scan over `agent_memories`. For agents with 1,000+ memories, recall quality degrades and query time increases linearly. Vector similarity search would dramatically improve both.

**Proposed Solution:**
- Enable `pgvector` extension in PostgreSQL
- Add `embedding vector(1536)` column to `agent_memories` table
- On memory creation, generate embeddings via Claude API or local embedding model
- Replace full-text search in `POST /api/agents/:id/memories/search` with cosine similarity ANN query
- Expose `similarity_threshold` and `top_k` as query params

**Acceptance Criteria:**
- [ ] `pgvector` enabled and `embedding` column added via migration
- [ ] Memory search returns results by semantic similarity
- [ ] Search latency < 50ms at 10,000 memories
- [ ] Fallback to text search if embedding unavailable

**References:** `server/src/services/agentMemories.ts`, `server/src/routes/agent-memories.ts`

---

## CATEGORY 5: Security (4 issues)

---

### ISSUE 24
**Title:** `[Security] Add IP allowlist support for authenticated/private deployment mode`
**Labels:** `security`, `backend`, `configuration`

**Description:**
In `authenticated + private` deployment mode, CrewSpace validates the request hostname but has no IP-level access control. Operators self-hosting on a VPC cannot restrict access to known IP ranges without an external reverse proxy.

**Proposed Solution:**
- Add `ipAllowlist: string[]` to instance settings (CIDR ranges supported via `ip-cidr` package)
- Apply IP check middleware early in the Express stack (before auth)
- `GET /api/health` exempted (needed for Docker health checks)
- Return `403 Forbidden` with body `{"error":"IP not in allowlist"}` for blocked requests
- Configurable via `CREWSPACE_IP_ALLOWLIST=10.0.0.0/8,192.168.0.0/16` env var

**Acceptance Criteria:**
- [ ] IP allowlist enforced in `private` exposure mode
- [ ] CIDR range support
- [ ] Health endpoint exempt
- [ ] Documented in deployment guide

**References:** `server/src/middleware/private-hostname-guard.ts`, `server/src/routes/instance-settings.ts`

---

### ISSUE 25
**Title:** `[Security] Implement secret rotation with automatic re-injection`
**Labels:** `security`, `backend`, `secrets`

**Description:**
Company secrets use version tracking (`company_secret_versions` table) but rotation is entirely manual — there is no automated rotation trigger, no notification when secrets are about to expire, and no automatic re-injection of new secret values into running agent contexts.

**Proposed Solution:**
- Add `expiresAt` and `rotationReminderDays` fields to secret schema
- Send in-app notification (activity log entry + UI badge) when a secret is within `rotationReminderDays` of expiry
- Add `POST /api/companies/:id/secrets/:key/rotate` endpoint that creates a new version and deprecates the old one
- After rotation, trigger a soft restart of agents that use the secret (clear cached env)

**Acceptance Criteria:**
- [ ] `expiresAt` field on secrets
- [ ] Reminder notification appearing `X` days before expiry
- [ ] Rotation endpoint creates new version atomically
- [ ] Agents pick up new secret value without full restart

**References:** `server/src/routes/secrets.ts`, `packages/db/src/schema/`

---

### ISSUE 26
**Title:** `[Security] Add CSP headers and CSRF protection to the API`
**Labels:** `security`, `backend`, `hardening`

**Description:**
The API server has no `Content-Security-Policy` headers on the served UI, and no CSRF token mechanism for state-mutating requests. In authenticated/public mode, this creates a cross-site request forgery attack surface.

**Proposed Solution:**
- Add `helmet.js` middleware for standard security headers (CSP, HSTS, X-Frame-Options, etc.)
- Add CSRF protection using `csurf` or SameSite cookie settings (since better-auth uses cookies)
- Configure CSP to allow: same origin, inline scripts blocked, plugin iframe origins whitelisted
- Test with browser security scanner (OWASP ZAP or similar)

**Acceptance Criteria:**
- [ ] `Content-Security-Policy` header present on all HTML responses
- [ ] `X-Frame-Options: SAMEORIGIN` set
- [ ] CSRF token validated on all state-mutating endpoints (`POST`, `PUT`, `DELETE`, `PATCH`)
- [ ] Plugin iframe origins correctly allowlisted in CSP
- [ ] No CSP violations in browser console in normal operation

**References:** `server/src/index.ts`

---

### ISSUE 27
**Title:** `[Security] Audit and restrict agent permissions using principle of least privilege`
**Labels:** `security`, `backend`, `agents`

**Description:**
The `principal_permission_grants` table supports fine-grained permissions, but agents are currently granted broad permissions by default. An agent acting as a routine worker should not be able to delete a company, hire other agents, or access secrets.

**Proposed Solution:**
- Define a permission matrix for each agent role (CEO, CTO, engineer, etc.)
- Enforce role-based permission defaults in `actorMiddleware`
- Add a UI in Agent Settings to view and override the agent's permission set
- Log every permission check denial to the activity log

**Acceptance Criteria:**
- [ ] Permission matrix defined and documented for each built-in role
- [ ] Engineer-level agent cannot call `/api/companies/:id/delete`
- [ ] Permission overrides visible and editable in agent settings UI
- [ ] Integration test verifying permission enforcement

**References:** `server/src/middleware/auth.ts`, `packages/db/src/schema/`

---

## CATEGORY 6: Developer Experience (4 issues)

---

### ISSUE 28
**Title:** `[DX] Add a `crewspaceai dev` command for hot-reload development mode`
**Labels:** `developer-experience`, `cli`

**Description:**
Local development currently requires running `pnpm dev` in the root which starts multiple Vite and TSX watch processes independently. There is no single command that starts the full stack (server + UI + embedded DB) with hot reload and proper log aggregation.

**Proposed Solution:**
- Add a `crewspaceai dev` CLI command that:
  - Starts embedded Postgres
  - Runs `server` with `tsx watch`
  - Runs `ui` with `vite dev`
  - Proxies all logs with a colored prefix (`[server]`, `[ui]`)
  - Opens the browser automatically when ready
- Use `concurrently` or a simple custom process manager

**Acceptance Criteria:**
- [ ] `crewspaceai dev` starts the full stack
- [ ] Single `Ctrl+C` stops all processes cleanly
- [ ] Browser opens automatically at `http://localhost:3100`
- [ ] Log prefixes distinguish server vs. UI output

**References:** `cli/src/commands/`, `package.json`

---

### ISSUE 29
**Title:** `[DX] Add OpenAPI / Swagger spec auto-generation for all API routes`
**Labels:** `developer-experience`, `documentation`, `api`

**Description:**
CrewSpace has 28+ route modules with no machine-readable API specification. Plugin authors, external integrators, and contributors have no way to discover available endpoints without reading source code.

**Proposed Solution:**
- Add `zod-to-openapi` or `tsoa` to auto-generate an OpenAPI 3.1 spec from route definitions and Zod schemas
- Serve the spec at `GET /api/openapi.json`
- Serve Swagger UI at `GET /api/docs` (disabled in production by default, enabled via instance setting)
- Publish the spec to the Mintlify docs site on each release

**Acceptance Criteria:**
- [ ] OpenAPI 3.1 spec generated and served at `/api/openapi.json`
- [ ] All 28 route modules documented
- [ ] Swagger UI accessible in development mode
- [ ] Spec published as artifact in release workflow

**References:** `server/src/routes/`, `docs/`

---

### ISSUE 30
**Title:** `[DX] Write a Plugin SDK quickstart guide and example plugin walkthrough`
**Labels:** `documentation`, `plugins`, `developer-experience`

**Description:**
The Plugin SDK (`packages/plugins/sdk/`) has TypeScript types and a scaffolding CLI (`create-crewspace-plugin`) but no written guide. Plugin authors must reverse-engineer the example plugin or read raw SDK source.

**Proposed Solution:**
- Write a `docs/plugins/quickstart.mdx` guide covering:
  1. Scaffold a new plugin with `npx create-crewspace-plugin`
  2. Register a UI slot (dashboard widget)
  3. Subscribe to a CrewSpace event (issue created)
  4. Persist state via the plugin state store
  5. Publish to npm and install in CrewSpace
- Add inline JSDoc comments to all public SDK exports
- Add a complete "todo-tracker" example plugin under `packages/plugins/examples/todo-tracker/`

**Acceptance Criteria:**
- [ ] Quickstart guide published in Mintlify docs
- [ ] JSDoc on all public SDK types/functions
- [ ] `todo-tracker` example plugin builds and installs successfully
- [ ] Guide reviewed by someone unfamiliar with the codebase

**References:** `packages/plugins/sdk/`, `packages/plugins/examples/`, `docs/`

---

### ISSUE 31
**Title:** `[DX] Add a `crewspaceai doctor` command to diagnose setup issues`
**Labels:** `developer-experience`, `cli`

**Description:**
New users often struggle with setup issues: wrong Node version, missing env vars, Postgres not running, ports in use, or corrupt config. The CLI `doctor` command currently exists but is minimal.

**Proposed Checks:**
- Node.js version ≥ 20
- pnpm version ≥ 9
- PostgreSQL reachable (embedded or external)
- Required ports (3100) not in use
- Config file exists and is valid JSON with required fields
- `BETTER_AUTH_SECRET` set and ≥ 32 chars
- Storage directory writable
- Claude Code / adapter binary accessible
- Network connectivity to LLM endpoints

**Output:** Colored checklist with ✅ / ❌ and actionable fix instructions for each failed check.

**Acceptance Criteria:**
- [ ] `crewspaceai doctor` runs all checks and prints results
- [ ] Each failed check includes a one-line fix instruction
- [ ] Exit code 1 if any check fails (for scripted use)
- [ ] `--fix` flag auto-resolves common issues (regenerate config, create missing dirs)

**References:** `cli/src/commands/doctor.ts`

---

## CATEGORY 7: Features & Enhancements (5 issues)

---

### ISSUE 32
**Title:** `[Feature] Add multi-user team collaboration with role-based access control`
**Labels:** `enhancement`, `feature`, `multi-user`, `priority`

**Description:**
CrewSpace's database schema includes `company_memberships` and `principal_permission_grants` tables designed for multi-user collaboration, but the feature is not surfaced in the UI or enforced in the backend. This is the most-requested missing feature.

**Proposed Scope:**
- Invite team members to a company via email (`POST /api/companies/:id/invite`)
- Assign roles: `owner`, `admin`, `member`, `viewer`
- `viewer` — read-only access to all company data
- `member` — can create/edit issues and comment; cannot change agents or settings
- `admin` — full access except company deletion
- `owner` — full access
- Role management UI in Company Settings
- Invitation email with accept link

**Acceptance Criteria:**
- [ ] Invite flow: send → accept → joined company
- [ ] Role-based API enforcement (403 on unauthorized actions)
- [ ] Role management UI in `/company/settings`
- [ ] E2E test covering invite and role enforcement

**References:** `packages/db/src/schema/`, `server/src/routes/companies.ts`, `ui/src/pages/CompanySettings.tsx`

---

### ISSUE 33
**Title:** `[Feature] Add agent-to-agent delegation and sub-task spawning`
**Labels:** `enhancement`, `feature`, `agents`, `multi-agent`

**Description:**
Currently, agents can only act on pre-assigned issues. There is no mechanism for one agent (e.g., the CEO) to programmatically delegate a new sub-task to another agent (e.g., an engineer) mid-execution.

**Proposed Solution:**
- Add a `delegateTask` tool available to agents in their skill set:
  ```json
  { "tool": "delegateTask", "params": { "assigneeAgentId": "...", "title": "...", "description": "...", "parentIssueId": "..." } }
  ```
- Creates a new child issue and assigns it to the target agent
- Emits an activity log entry and notifies the target agent's next heartbeat
- Add a "Delegated by" field on issue detail showing the originating agent

**Acceptance Criteria:**
- [ ] `delegateTask` skill available to configured agents
- [ ] Child issue created with correct parent link
- [ ] Target agent picks up delegated task on next heartbeat
- [ ] UI shows delegation chain on issue detail

**References:** `server/src/services/workspace-runtime.ts`, `skills/`, `server/src/routes/issues.ts`

---

### ISSUE 34
**Title:** `[Feature] Add real-time notifications via WebSocket for issue and approval events`
**Labels:** `enhancement`, `feature`, `real-time`, `ui`

**Description:**
Users must manually refresh pages to see new issues, approval requests, or agent status changes. The WebSocket infrastructure already exists in the backend but is not connected to browser notification events.

**Proposed Solution:**
- Emit WebSocket events for: new issue, issue status change, new approval request, agent status change, new comment
- Subscribe on the client in a `useWebSocket` hook (Zustand-backed)
- Show toast notifications for relevant events (e.g., "Agent X completed task Y")
- Add a notification bell icon in the header with an unread count badge
- Mark notifications as read on click

**Acceptance Criteria:**
- [ ] WebSocket events emitted for all listed event types
- [ ] Toast notifications appear without page refresh
- [ ] Notification bell with unread count in header
- [ ] Notifications persist across page navigations

**References:** `server/src/index.ts` (ws setup), `ui/src/`, `server/src/services/activity-log.ts`

---

### ISSUE 35
**Title:** `[Feature] Add company export/import UI wizard with conflict resolution`
**Labels:** `enhancement`, `feature`, `portability`

**Description:**
Company export (`/company/export`) and import (`/company/import`) routes exist and work via API, but the import UI (`pages/CompanyImport.tsx`) has no conflict resolution step — if a company with the same name already exists, the import silently fails or creates a duplicate.

**Proposed Solution:**
- Add a multi-step import wizard:
  1. Upload JSON file → validate and preview summary (agent count, issue count, etc.)
  2. Conflict detection: show which agents/projects conflict with existing data
  3. Resolution options per conflict: Skip, Rename, Replace
  4. Confirm and import with progress indicator
  5. Success summary with links to imported entities
- Add `dryRun: true` param to import API to get conflict report without committing

**Acceptance Criteria:**
- [ ] Import wizard shows preview before committing
- [ ] Conflict detection surfaces all collisions
- [ ] Per-conflict resolution (skip/rename/replace) works
- [ ] Import API supports `dryRun` mode
- [ ] E2E test covers full import wizard flow

**References:** `ui/src/pages/CompanyImport.tsx`, `server/src/services/company-portability.ts`

---

## CATEGORY 8: Infrastructure & DevOps (3 issues)

---

### ISSUE 36
**Title:** `[Infra] Add Prometheus metrics endpoint for production observability`
**Labels:** `observability`, `infrastructure`, `monitoring`

**Description:**
There is no metrics endpoint for production monitoring. Operators running CrewSpace in production have no way to alert on error rates, request latency, database pool utilization, or agent execution failures without building custom tooling.

**Proposed Solution:**
- Add `prom-client` to the server
- Expose `GET /metrics` (Prometheus scrape endpoint, protected by instance-admin auth)
- Instrument key metrics:
  - `http_request_duration_seconds` (histogram by route + status)
  - `active_agents_total` (gauge by company)
  - `heartbeat_run_duration_seconds` (histogram)
  - `cost_events_total` (counter by company)
  - `db_pool_connections` (gauge)
- Add a Grafana dashboard JSON template to `docs/monitoring/`

**Acceptance Criteria:**
- [ ] `/metrics` endpoint returns valid Prometheus text format
- [ ] All listed metrics instrumented
- [ ] Endpoint requires instance-admin auth
- [ ] Grafana dashboard template included in docs

**References:** `server/src/index.ts`, `server/src/routes/health.ts`

---

### ISSUE 37
**Title:** `[Infra] Add Docker health check and graceful shutdown handling`
**Labels:** `infrastructure`, `docker`, `reliability`

**Description:**
The Docker container has no `HEALTHCHECK` instruction. Container orchestrators (Docker Swarm, ECS, Kubernetes) cannot determine if the container is ready to serve traffic or should be restarted, leading to traffic routed to unhealthy containers.

Additionally, the Express server does not handle `SIGTERM` gracefully — in-flight requests are dropped when the container is stopped.

**Proposed Solution:**
- Add `HEALTHCHECK` to `docker/Dockerfile`:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3100/api/health || exit 1
  ```
- Implement graceful shutdown in `server/src/index.ts`:
  - On `SIGTERM`, stop accepting new connections
  - Wait for in-flight requests to complete (30s timeout)
  - Close DB pool cleanly
  - Exit 0

**Acceptance Criteria:**
- [ ] `HEALTHCHECK` added to Dockerfile
- [ ] `docker inspect` shows `healthy` status after startup
- [ ] `SIGTERM` completes in-flight requests before exit
- [ ] Graceful shutdown test in CI (send SIGTERM, verify clean exit)

**References:** `docker/Dockerfile`, `server/src/index.ts`

---

### ISSUE 38
**Title:** `[Infra] Add automated database migration validation in CI`
**Labels:** `infrastructure`, `ci`, `database`

**Description:**
Database migrations run automatically on startup but are never validated in CI. A broken migration only surfaces when the container starts in production — potentially causing downtime.

**Proposed Solution:**
- Add a CI step in `pr.yml` that:
  1. Starts a fresh PostgreSQL Docker container
  2. Runs all migrations against it
  3. Verifies the final schema matches the Drizzle schema definition (`drizzle-kit check`)
  4. Runs a rollback test (if down migrations exist)
- Add `drizzle-kit check` to the existing `verify` job

**Acceptance Criteria:**
- [ ] Migration validation runs on every PR
- [ ] Broken migration fails the PR check with clear error output
- [ ] `drizzle-kit check` confirms schema consistency
- [ ] Runs in < 2 minutes

**References:** `.github/workflows/pr.yml`, `packages/db/src/migrations/`

---

## Summary

| # | Title | Category | Priority |
|---|-------|----------|----------|
| 1 | Global error boundary | UI Stability | High |
| 2 | Kanban drag-drop flicker | UI Stability | Medium |
| 3 | Re-enable worktree UI | UI Stability | Medium |
| 4 | 3D Office loading state | UI Stability | Medium |
| 5 | Pagination for lists | UI Stability | High |
| 6 | Restore Skills view | UI Stability | Medium |
| 7 | Mobile responsive layout | UI Stability | Low |
| 8 | Expand E2E suite | Testing | Critical |
| 9 | Unit tests for services | Testing | High |
| 10 | Plugin lifecycle E2E | Testing | High |
| 11 | Multi-company isolation tests | Testing | Critical |
| 12 | Visual regression testing | Testing | Medium |
| 13 | Load testing at 100+ agents | Testing | Medium |
| 14 | Hash agent API keys | Security | Critical |
| 15 | Rate limiting | Security | High |
| 16 | SSE error handling | Backend | High |
| 17 | DB pool monitoring | Backend | Medium |
| 18 | Idempotent task checkout TTL | Backend | Critical |
| 19 | Correlation ID logging | Backend | Medium |
| 20 | Database query indices | Performance | High |
| 21 | Dashboard caching | Performance | Medium |
| 22 | Lazy-load 3D Office | Performance | Medium |
| 23 | Vector search for memories | Performance | Medium |
| 24 | IP allowlist support | Security | Medium |
| 25 | Secret rotation | Security | Medium |
| 26 | CSP headers and CSRF | Security | High |
| 27 | Agent permission audit | Security | High |
| 28 | `crewspaceai dev` command | DX | Medium |
| 29 | OpenAPI spec generation | DX | Medium |
| 30 | Plugin SDK quickstart guide | DX | Medium |
| 31 | Enhanced `doctor` command | DX | Low |
| 32 | Multi-user RBAC | Features | Critical |
| 33 | Agent-to-agent delegation | Features | High |
| 34 | Real-time WebSocket notifications | Features | High |
| 35 | Import wizard with conflict resolution | Features | Medium |
| 36 | Prometheus metrics endpoint | Infra | Medium |
| 37 | Docker HEALTHCHECK + graceful shutdown | Infra | High |
| 38 | Migration validation in CI | Infra | High |
