# CrewSpace — Claude Context Graph

> This file is auto-loaded by Claude Code at session start. It gives instant codebase orientation so Claude never has to re-explore from scratch.

---

## Monorepo Layout

```
crewspace/
├── server/          @crewspaceai/server   — Express 5 API (port 3100)
├── ui/              @crewspaceai/ui       — React 19 + Vite (port 5173)
├── cli/             @crewspaceai/cli      — Agent orchestration CLI
├── packages/
│   ├── db/          @crewspaceai/db       — Drizzle ORM + migrations (62 tables)
│   ├── shared/      @crewspaceai/shared   — Zod types shared by all packages
│   └── adapters/    (claude, gemini, cursor, codex, opencode, pi, openclaw)
├── docker/          — docker-compose.yml + .env for containerised stack
└── scripts/         — dev-runner.ts, backup-db.sh, release.sh, …
```

**Package manager:** pnpm 9.15.4 with workspaces  
**Node requirement:** 20+

---

## Dev Commands

| Task | Command |
|------|---------|
| Start everything | `pnpm dev` |
| Server only | `pnpm dev:server` (port 3100) |
| UI only | `pnpm dev:ui` (port 5173) |
| Run unit tests | `pnpm test:run` (Vitest) |
| Run e2e tests | `pnpm test:e2e` (Playwright) |
| Type-check | `pnpm typecheck` |
| Build all | `pnpm build` |
| New migration | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |

**UI dev workflow:** Vite at 5173 proxies `/api/*` → Docker server at localhost:3100.  
**Never rebuild Docker just for UI changes** — Vite hot-reload covers all frontend work.

---

## Docker Stack

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env up -d --no-build
```

| Service | Image | Port |
|---------|-------|------|
| db | postgres:17-alpine | 5432 |
| server | crewspace image | 3100 |

Required `docker/.env` keys:
```
BETTER_AUTH_SECRET=
CREWSPACE_PUBLIC_URL=http://localhost:3100
CREWSPACE_AGENT_JWT_SECRET=
```

---

## Server Architecture (`server/src/`)

### Entry & Config
- **`index.ts`** — `startServer()`, port detection, DB init, WebSocket setup
- **`app.ts`** — Express app, middleware chain, route mounting
- **`config.ts`** — Reads env vars + crewspace.yml (env vars take priority)

### Key Env Vars
```
DATABASE_URL                   # Postgres connection string
PORT                           # API port (default 3100)
SERVE_UI                       # "true" = bundle UI with server
CREWSPACE_DEPLOYMENT_MODE      # "local_trusted" | "authenticated"
CREWSPACE_DEPLOYMENT_EXPOSURE  # "private" | "cloud"
CREWSPACE_PUBLIC_URL           # Public base URL
BETTER_AUTH_SECRET             # Session signing key
CREWSPACE_AGENT_JWT_SECRET     # Agent JWT secret
CREWSPACE_SECRETS_PROVIDER     # "native" | "vault"
CREWSPACE_STORAGE_PROVIDER     # "local" | "s3"
```

### Middleware Chain (in order)
1. **`auth.ts`** — Resolves `req.actor` from Better-Auth session OR agent JWT OR `local_implicit`
2. **`logger.ts`** — Pino HTTP logging
3. **`board-mutation-guard.ts`** — Guards write operations
4. **`private-hostname-guard.ts`** — Rejects requests from wrong hostnames
5. **`validate.ts`** — Zod schema validation helper
6. **`error-handler.ts`** — Formats all errors with status codes

### Actor Types
- `local_trusted` — dev mode, implicit admin
- `authenticated` — production, Better-Auth session + company membership
- `board` JWT — agent→server calls (signed with `CREWSPACE_AGENT_JWT_SECRET`)

### Route Modules (`server/src/routes/`) — 28 files
```
access            agent-memories    agents            approvals
assets            authz             companies         company-skills
costs             dashboard         execution-workspaces  goals
health            index             instance-settings issues
issues-checkout-wakeup  llms        org-chart-svg     plugin-ui-static
plugins           projects          routines          secrets
sidebar-badges    sprints           terminal
```

### Services (`server/src/services/`)
Key services: `agentMemories`, `heartbeatService`, `routineService`, `boardAuthService`  
Plugin system: worker manager, job scheduler, event bus

### Auth System
- **Better-Auth 1.4.18** — `server/src/auth/better-auth.ts`
- Tables: `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`
- Bootstrap flow: server auto-creates `pcp_bootstrap_<hex>` invite if no admin exists; token exposed via `/api/health` as `bootstrapInviteToken`

### Realtime
- WebSocket server: `server/src/realtime/live-events-ws.js`
- Backend publishes events → UI subscribes via `LiveUpdatesProvider` context

---

## Database (`packages/db/src/schema/`) — 62 Tables

### Core Entities
| Table | Purpose |
|-------|---------|
| `companies` | Primary tenant unit |
| `company_memberships` | User ↔ company relationships |
| `agents` | AI agents within a company |
| `projects` | Work containers |
| `issues` | Tasks / work items |
| `routines` | Scheduled agent workflows |
| `goals` | Objectives |
| `approvals` | Human-in-the-loop gates |

### Agent-Specific
| Table | Purpose |
|-------|---------|
| `agent_memories` | Memory nodes (fact/insight/decision/pattern/task/observation/learning) |
| `agent_memory_agents` | Memory ↔ agent join (with `isOwner` flag) |
| `agent_memory_links` | Edges between memories (related_to/supports/contradicts/precedes/derived_from/example_of) |
| `agent_api_keys` | JWT keys for agent auth |
| `agent_config_revisions` | Config history |
| `agent_runtime_state` | Live agent state |
| `agent_wakeup_requests` | Scheduled agent wake-ups |

### Governance
`budget_policies`, `budget_incidents`, `cost_events`, `approval_comments`

### Auth
`auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`

### ORM
- **Drizzle ORM 0.38.4** — schema-first, migrations in `packages/db/src/migrations/`
- All schemas re-exported from `packages/db/src/schema/index.ts`

---

## UI Architecture (`ui/src/`)

### Stack
- **React 19** + **React Router 7**
- **TanStack Query 5** (`useQuery`/`useMutation`) for all server state
- **Tailwind CSS 4** for styling
- **Three.js + React Three Fiber** for 3D office
- **Radix UI + Shadcn** base components
- **Better-Auth** session (cookie-based)

### Vite Proxy
```
/api/* → http://localhost:3100
```
All API calls use relative paths — works identically in dev (Vite) and prod (SERVE_UI=true).

### App Entry & Gates
```
main.tsx
  └── App.tsx
        └── CloudAccessGate   — checks /api/health, handles bootstrap + auth redirect
              └── Router
                    ├── /auth, /invite/:token, /cli-auth, /board-claim
                    ├── /onboarding
                    └── (company-scoped routes)
```

### All Pages (`ui/src/pages/`)
```
Activity          AgentChat         AgentDetail       Agents
ApprovalDetail    Approvals         Auth              Blockers
BoardClaim        CeoTerminal       CliAuth           Companies
CompanyExport     CompanyImport     CompanySettings   CompanySkills
Costs             Dashboard         DesignGuide       ExecutionWorkspaceDetail
GoalDetail        Goals             Inbox             InstanceExperimentalSettings
InstanceGeneralSettings  InstanceSettings  InviteLanding  IssueDetail
Issues            MemoryGraph       NewAgent          NotFound
Office (lazy)     OrgChart          PluginManager     PluginPage
PluginSettings    ProjectDetail     ProjectWorkspaceDetail  Projects
RoutineDetail     Routines          RunTranscriptUxLab  Taskboard
```

### Context Providers (10)
| Context | File | Purpose |
|---------|------|---------|
| `CompanyProvider` | context/CompanyContext.tsx | Selected company, company list |
| `ChatContext` | context/ChatContext.tsx | Agent chat sessions + messages |
| `LiveUpdatesProvider` | context/LiveUpdatesContext.tsx | WebSocket subscriptions |
| `DialogContext` | context/DialogContext.tsx | Global modal/dialog state |
| `ToastProvider` | context/ToastContext.tsx | Notification toasts |
| `ThemeProvider` | context/ThemeContext.tsx | Dark/light mode |
| `PanelProvider` | context/PanelContext.tsx | Right panel state |
| `SidebarProvider` | context/SidebarContext.tsx | Nav sidebar state |
| `BreadcrumbContext` | context/BreadcrumbContext.tsx | Page breadcrumbs |

### API Client Pattern
```typescript
// All API calls go through ui/src/api/client.ts
// fetch() with credentials: "include", cache: "no-store"
// Base path: /api
//
// Module files: agents.ts, companies.ts, agentMemories.ts, approvals.ts,
//               assets.ts, auth.ts, budgets.ts, costs.ts, health.ts,
//               issues.ts, plugins.ts, projects.ts, routines.ts, goals.ts
//
// Consumed in components via React Query:
const { data } = useQuery({
  queryKey: queryKeys.agents.list(companyId),
  queryFn: () => agentsApi.list(companyId),
});
```

### Query Keys (`ui/src/lib/queryKeys.ts`)
All cache keys are centralized here. Always use `queryKeys.*` for consistency.

### Theming
- Default: **dark** (`#0f172a` background)
- CSS custom properties in `ui/src/index.css` under `:root`
- Light theme stored in `localStorage` as `crewspace.theme`
- `<html>` gets `.dark` class for dark mode

---

## Memory Graph System

### Data Flow
```
/api/companies/:id/memories/graph
  → agentMemories.listGraph()     (server/src/services/agentMemories.ts)
  → agent_memories + agent_memory_agents + agent_memory_links tables
  → { memories: AgentMemory[], links: AgentMemoryLink[] }
  → MemoryGraph.tsx               (ui/src/pages/MemoryGraph.tsx)
  → 3D Canvas with Fibonacci sphere layout
```

### Memory Types
`fact` | `insight` | `decision` | `pattern` | `task` | `observation` | `learning`

### Link Relationship Types
`related_to` | `supports` | `contradicts` | `precedes` | `derived_from` | `example_of`

### 3D Rendering (MemoryGraph.tsx — 1079 lines)
- Custom canvas-based WebGL-style 2D renderer with perspective projection
- Agents on inner sphere, memories on outer sphere
- Fibonacci sphere distribution for even node spacing
- Rodrigues rotation formula for drift animation
- Mouse hit-testing in projected 2D space

---

## Agent Chat System

### Context (`ui/src/context/ChatContext.tsx`)
```typescript
interface ChatSession {
  id: string;
  primaryAgentId: string;
  participants: Agent[];
  messages: ChatMessage[];
  updatedAt: Date;
  name?: string;          // optional rename (group chats)
}
```
Methods: `openChatWithAgent`, `openChatWithAgents`, `updateSession`, `deleteSession`, `renameSession`

**No pre-initialization** — sessions are created only when user explicitly starts a chat.

### UI Entry Points
- **Sidebar**: `components/ChatSidebar.tsx` — slide-in panel from any page
- **Full page**: `pages/AgentChat.tsx` — `/agent-chat` route, two-column layout

### Streaming
- `lib/agentChat.ts → streamAgentChat()` — SSE streaming from agent endpoint
- Each message auto-saved to memory graph after agent responds

---

## 3D Office (`ui/src/pages/office/`)

- Three.js scene with agent desks/rooms
- `HumanAgent.tsx` — individual agent avatar
  - Name tooltip: `<Html>` at position `[0, 1.75, 0]` (above head), `distanceFactor=15`
  - Detail card: `<Html>` at position `[0, 2.55, 0]`, `distanceFactor=12`
- Agent status dots color-coded by status

---

## Key Patterns & Conventions

### Adding a New API Endpoint
1. Add route in `server/src/routes/<domain>.ts`
2. Add service method in `server/src/services/<domain>.ts`
3. Add typed API function in `ui/src/api/<domain>.ts`
4. Consume via `useQuery`/`useMutation` in component

### Adding a New Page
1. Create `ui/src/pages/MyPage.tsx`
2. Add lazy import + route in `ui/src/App.tsx`
3. Add nav item in `ui/src/components/CompanyRail.tsx` if needed

### Adding a DB Table
1. Create `packages/db/src/schema/my_table.ts`
2. Export from `packages/db/src/schema/index.ts`
3. Run `pnpm db:generate` then `pnpm db:migrate`

### HTTP Cache
All fetch calls use `cache: "no-store"` to prevent stale HTTP 304 responses.

### Component Import Alias
```typescript
import { X } from "@/components/ui/button";  // @/ = ui/src/
```

---

## Important Files Quick Reference

| File | What it does |
|------|-------------|
| `server/src/routes/health.ts` | `/api/health` — bootstrap status, deployment info |
| `server/src/routes/access.ts` | Invite accept, company access, bootstrap flow |
| `ui/src/pages/InviteLanding.tsx` | Bootstrap invite UI + health cache update |
| `ui/src/pages/Auth.tsx` | Login/signup, `lockToSignup` for bootstrap |
| `ui/src/components/CloudAccessGate.tsx` | Top-level auth + health gate |
| `ui/src/lib/queryKeys.ts` | All React Query cache keys (centralized) |
| `ui/src/api/client.ts` | Base fetch wrapper (credentials, no-store cache) |
| `ui/src/components/ReportsToPicker.tsx` | "Reports to" agent picker (side=bottom popover) |
| `ui/src/components/AgentConfigForm.tsx` | Agent create/edit form |
| `ui/src/context/ChatContext.tsx` | Chat session state management |
| `packages/db/src/schema/agent_memories.ts` | Memory graph DB schema |
| `docker/docker-compose.yml` | Container stack definition |
| `docker/.env` | Secrets for Docker (BETTER_AUTH_SECRET, etc.) |

---

## Known Patterns to Follow

- **Dark theme always**: `:root` CSS vars use `#0f172a` background — no white loading states
- **Popover dropdowns**: Use `side="bottom" avoidCollisions collisionPadding={8}` to prevent viewport overflow
- **No pre-initialized chat sessions**: Sessions created on demand only
- **Memory graph cache**: Use `cache: "no-store"` on all fetches to avoid stale 304s
- **Bootstrap idempotency**: Accept endpoint returns 202 if user is already admin
- **Favicon**: `ui/public/favicon.svg` uses CrewSpace triangle-network logo (not paperclip)
- **Logo**: `CrewSpaceIcon` from `ui/src/lib/icons.ts` — triangle with three filled circles
