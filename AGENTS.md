# AGENTS.md

Guidance for human and AI contributors working in this repository.

## 1. Project Overview

**CrewSpace** is a control plane for autonomous AI-agent companies. One instance can run multiple companies. A **company** is a first-order object that contains AI agents (employees), an org chart, goals, tasks (issues), budgets, and approvals. CrewSpace orchestrates agents but does not run them — agents execute externally and phone home via adapters.

The current implementation target is V1 and is defined in `doc/SPEC-implementation.md`. `doc/SPEC.md` is the long-horizon product context.

### 1.1 Runtime Architecture

- **Control Plane**: Central REST API (`server/`) and React board UI (`ui/`)
- **Execution Services**: External agents connected via adapters (`packages/adapters/*`)
- **Data Layer**: PostgreSQL via Drizzle ORM (`packages/db/`)
- **CLI**: Operator-facing CLI for setup, orchestration, and control-plane operations (`cli/`)

### 1.2 Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+, TypeScript 5.7+, ESM |
| Package Manager | pnpm 9.15.4 (workspace monorepo) |
| API Server | Express 5, `better-auth` 1.4.18, `drizzle-orm` 0.38.4 |
| Database | PostgreSQL (embedded PGlite default, Docker/Supabase optional) |
| UI | React 19, Vite 6, Tailwind CSS 4, React Router 7, Zustand |
| Testing | Vitest 3, Playwright 1.58+ |
| Logging | Pino (structured JSON in production) |
| Validation | Zod, AJV |

## 2. Read This First

Before making changes, read in this order:

1. `doc/GOAL.md` — vision and core principles
2. `doc/PRODUCT.md` — product definition and user flows
3. `doc/SPEC-implementation.md` — concrete V1 build contract
4. `doc/DEVELOPING.md` — dev setup, CLI usage, worktrees
5. `doc/DATABASE.md` — DB options, migrations, secrets storage
6. `doc/DEPLOYMENT-MODES.md` — runtime auth modes (`local_trusted` / `authenticated`)

## 3. Repo Map

### 3.1 Applications

- `server/` — Express REST API and orchestration services. Built with `tsc`. Serves UI static assets in production.
- `ui/` — React + Vite board UI. Built to `ui/dist/` and copied into `server/ui-dist` for serving.
- `cli/` — CrewSpace CLI (`crewspaceai` npm package). Built with esbuild.

### 3.2 Shared Packages

- `packages/db/` — Drizzle schema (`src/schema/*.ts`), migrations, seed scripts, and DB clients. Exports schema via `src/schema/index.ts`.
- `packages/shared/` — Shared types, constants, validators, Zod schemas, and API path constants.
- `packages/adapter-utils/` — Shared adapter utilities and base interfaces.

### 3.3 Adapters

Each adapter is an independent package under `packages/adapters/`:

- `claude-local` — Claude Code local process adapter
- `codex-local` — OpenAI Codex local process adapter
- `cursor-local` — Cursor IDE adapter
- `gemini-local` — Google Gemini adapter
- `kimi-local` — Kimi adapter
- `openclaw-gateway` — OpenClaw HTTP gateway adapter
- `opencode-local` — Opencode adapter
- `pi-local` — Pi adapter
- `hermes-crewspace-adapter` — Shared runtime adapter interface

Adapters export up to four subpaths: `.` (common), `/server`, `/ui`, `/cli`.

### 3.4 Plugins

- `packages/plugins/sdk/` — Plugin SDK for third-party extensions
- `packages/plugins/create-crewspace-plugin/` — Plugin scaffolding tool
- `packages/plugins/examples/` — Example plugins

### 3.5 Docs

- `doc/` — Operational and product docs (SPEC, DEVELOPING, DATABASE, etc.)
- `docs/` — Public documentation site (Mintlify)
- `releases/` — Release changelogs (`vYYYY.MDD.P.md`)

## 4. Dev Setup

Use embedded PostgreSQL in dev by leaving `DATABASE_URL` unset.

```sh
pnpm install
pnpm dev
```

This starts:

- API: `http://localhost:3100`
- UI: `http://localhost:3100` (served by API server in dev middleware mode)

Quick checks:

```sh
curl http://localhost:3100/api/health
curl http://localhost:3100/api/companies
```

Reset local dev DB:

```sh
rm -rf data/pglite
pnpm dev
```

One-command local run (auto-onboards if needed):

```sh
pnpm crewspace run
```

Tailscale/private-auth dev mode:

```sh
pnpm dev --tailscale-auth
```

## 5. Build, Test, and Verification Commands

### 5.1 Development

| Command | Purpose |
|---|---|
| `pnpm dev` | Start API + UI in watch mode (auto-restarts on changes) |
| `pnpm dev:once` | Start once without file watching |
| `pnpm dev:list` | List current dev runner processes |
| `pnpm dev:stop` | Stop current dev runner |
| `pnpm dev:server` | Start server only |
| `pnpm dev:ui` | Start Vite dev server for UI only |

### 5.2 Build

| Command | Purpose |
|---|---|
| `pnpm build` | Build all workspace packages (`pnpm -r build`) |
| `pnpm typecheck` | Type-check all packages (`pnpm -r typecheck`) |

### 5.3 Database

| Command | Purpose |
|---|---|
| `pnpm db:generate` | Compile schema and generate Drizzle migration |
| `pnpm db:migrate` | Apply pending migrations |

Notes:
- `packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`
- `pnpm db:generate` compiles `packages/db` first

### 5.4 Testing

| Command | Purpose |
|---|---|
| `pnpm test` | Run Vitest in watch mode |
| `pnpm test:run` | Run Vitest once across all projects |
| `pnpm test:e2e` | Run Playwright E2E tests (starts `pnpm crewspace run` automatically) |
| `pnpm test:e2e:headed` | Run E2E tests in headed mode |
| `pnpm test:release-smoke` | Release smoke tests via Playwright |

Vitest projects (from root `vitest.config.ts`):
- `packages/db`
- `packages/adapters/codex-local`
- `packages/adapters/opencode-local`
- `server`
- `ui`
- `cli`

### 5.5 Verification Before Hand-off

Run this full check before claiming done:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

If anything cannot be run, explicitly report what was not run and why.

## 6. Core Engineering Rules

1. **Keep changes company-scoped.** Every domain entity should be scoped to a company and company boundaries must be enforced in routes/services.

2. **Keep contracts synchronized.** If you change schema/API behavior, update all impacted layers:
   - `packages/db` schema and exports
   - `packages/shared` types/constants/validators
   - `server` routes/services
   - `ui` API clients and pages

3. **Preserve control-plane invariants.**
   - Single-assignee task model
   - Atomic issue checkout semantics
   - Approval gates for governed actions
   - Budget hard-stop auto-pause behavior
   - Activity logging for mutating actions

4. **Do not replace strategic docs wholesale unless asked.** Prefer additive updates. Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned.

5. **Keep plan docs dated and centralized.** New plan documents belong in `doc/plans/` and should use `YYYY-MM-DD-slug.md` filenames.

## 7. Database Change Workflow

When changing the data model:

1. Edit `packages/db/src/schema/*.ts`
2. Ensure new tables are exported from `packages/db/src/schema/index.ts`
3. Generate migration:

```sh
pnpm db:generate
```

4. Validate compile:

```sh
pnpm -r typecheck
```

## 8. Code Style and TypeScript Conventions

- **Module system**: ESM only (`"type": "module"` in all packages)
- **TSConfig**: `strict: true`, `moduleResolution: bundler`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`
- **UI paths**: `@/*` maps to `./src/*`
- **No `any`**: Prefer explicit types; shared types live in `packages/shared/`
- **Formatting**: Follow existing file conventions; no enforced formatter config is present
- **Naming**: Use camelCase for variables/functions, PascalCase for types/components, kebab-case for filenames

## 9. API and Auth Expectations

- Base path: `/api`
- Board access is treated as full-control operator context
- Agent access uses bearer API keys (`agent_api_keys`), hashed at rest
- Agent keys must not access other companies

When adding endpoints:

- Apply company access checks
- Enforce actor permissions (board vs agent)
- Write activity log entries for mutations
- Return consistent HTTP errors (`400/401/403/404/409/422/500`)

## 10. UI Expectations

- Keep routes and nav aligned with available API surface
- Use company selection context for company-scoped pages
- Surface failures clearly; do not silently ignore API errors

## 11. Adapter and Plugin Conventions

### 11.1 Adapter Packages

- Each adapter lives in `packages/adapters/<name>/`
- Must export a `package.json` with `.`, `/server`, `/ui`, `/cli` subpaths where applicable
- Adapters depend on `@crewspaceai/adapter-utils` for shared interfaces
- Adapters can include `skills/` directories that are bundled at publish time

### 11.2 Plugin Packages

- Plugins use `@crewspaceai/plugin-sdk`
- Plugin examples live in `packages/plugins/examples/`
- Scaffold new plugins with `packages/plugins/create-crewspace-plugin/`

## 12. Testing Strategy

### 12.1 Unit Tests (Vitest)

- State transition guards (agent, issue, approval)
- Budget enforcement rules
- Adapter invocation/cancel semantics
- JWT/auth helpers

### 12.2 Integration Tests (Vitest + Playwright)

- Atomic checkout conflict behavior
- Approval-to-agent creation flow
- Cost ingestion and rollup correctness
- Pause while run is active (graceful cancel then force kill)

### 12.3 End-to-End Tests (Playwright)

- Board creates company → hires CEO → approves strategy → CEO receives work
- Agent reports cost → budget threshold reached → auto-pause occurs
- Task delegation across teams with request depth increment

### 12.4 Regression Suite Minimum

A release candidate is blocked unless these pass:

1. Auth boundary tests
2. Checkout race test
3. Hard budget stop test
4. Agent pause/resume test
5. Dashboard summary consistency test

## 13. Security Considerations

- **API keys**: Store only hashed agent API keys; plaintext shown once at creation
- **Secrets**: Use `company_secrets` + `company_secret_versions` with `local_encrypted` provider by default. Strict mode blocks inline sensitive env values.
- **Redaction**: Redact secrets in logs (`adapter_config`, auth headers, env vars)
- **CSRF**: CSRF protection for board session endpoints
- **Rate limiting**: Rate-limit auth and key-management endpoints
- **Company boundaries**: Strict company boundary checks on every entity fetch/mutation
- **Deployment modes**: `local_trusted` is loopback-only with no login; `authenticated` requires sessions and supports `private` / `public` exposure policies

## 14. Deployment and CI/CD

### 14.1 GitHub Actions Workflows

- `pr.yml` — Policy checks (lockfile validation, Dockerfile sync), typecheck, test, build, canary dry-run
- `release.yml` — Canary publish on every `main` push; stable publish on manual workflow dispatch
- `docker.yml` — Build and push multi-arch Docker image to GHCR on `main` pushes and version tags
- `e2e.yml` — Run E2E tests
- `refresh-lockfile.yml` — Automated lockfile maintenance

### 14.2 Dependency Lockfile Policy

GitHub Actions owns `pnpm-lock.yaml`.

- Do not commit `pnpm-lock.yaml` in pull requests.
- Pull request CI validates dependency resolution when manifests change.
- Pushes to `main` regenerate `pnpm-lock.yaml` with `pnpm install --lockfile-only --no-frozen-lockfile`, commit it back if needed, and then run verification with `--frozen-lockfile`.

### 14.3 Docker

- Dockerfile: `docker/Dockerfile`
- Multi-stage build: `deps` → `build` → `production`
- Pre-installs `@anthropic-ai/claude-code`, `@openai/codex`, `opencode-ai` in production stage
- Default deployment mode in container: `authenticated/private`
- Volume mount `/crewspace` for persistence

### 14.4 Release Process

- Canary: auto-published on every `main` push (`scripts/release.sh canary`)
- Stable: manually triggered via GitHub Actions (`scripts/release.sh stable`)
- GitHub releases: auto-created for stable tags (`scripts/create-github-release.sh`)

## 15. Definition of Done

A change is done when all are true:

1. Behavior matches `doc/SPEC-implementation.md`
2. Typecheck, tests, and build pass
3. Contracts are synced across db/shared/server/ui
4. Docs updated when behavior or commands change
