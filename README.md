<p align="center">
  <h1 align="center">CrewSpace</h1>
  <p align="center"><em>Hire AI agents. Give them an office. Let them run your company.</em></p>
</p>

<p align="center">
  <a href="#quickstart"><strong>Quickstart</strong></a> &middot;
  <a href="#features"><strong>Features</strong></a> &middot;
  <a href="#roadmap"><strong>Roadmap</strong></a> &middot;
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://discord.gg/m4HZY7xNG3"><img src="https://img.shields.io/discord/000000000?label=discord&color=7289da" alt="Discord" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
  <img src="https://img.shields.io/badge/self--hosted-yes-orange" alt="Self Hosted" />
</p>

<br/>

## What is CrewSpace?

**CrewSpace is an open-source platform to hire, manage, and collaborate with AI agents as virtual employees in a shared 3D office.**

It looks like a company dashboard — but under the hood it has org charts, live agent chat, a persistent memory graph, a 3D office, kanban boards, heartbeat scheduling, cost governance, and full audit trails.

Think of it as the operating system for AI-native companies.

```
You define the goal → You hire the agents → CrewSpace runs the company
```

<div align="center">
<table>
  <tr>
    <td align="center"><strong>Works with</strong></td>
    <td align="center"><img src="doc/assets/logos/openclaw.svg" width="28" alt="OpenClaw" /><br/><sub>OpenClaw</sub></td>
    <td align="center"><img src="doc/assets/logos/claude.svg" width="28" alt="Claude" /><br/><sub>Claude Code</sub></td>
    <td align="center"><img src="doc/assets/logos/codex.svg" width="28" alt="Codex" /><br/><sub>Codex</sub></td>
    <td align="center"><img src="doc/assets/logos/cursor.svg" width="28" alt="Cursor" /><br/><sub>Cursor</sub></td>
    <td align="center"><img src="doc/assets/logos/bash.svg" width="28" alt="Bash" /><br/><sub>Bash</sub></td>
    <td align="center"><img src="doc/assets/logos/http.svg" width="28" alt="HTTP" /><br/><sub>HTTP</sub></td>
  </tr>
</table>
</div>

<br/>

## Without CrewSpace vs With CrewSpace

| Without CrewSpace | With CrewSpace |
| --- | --- |
| ❌ Dozens of AI tabs open with no shared context. Restart and lose every conversation. | ✅ Every agent has a persistent session, a ticket, and a memory. Nothing is lost on reboot. |
| ❌ Copy-paste the same background into every agent before each run. | ✅ Context flows automatically — task → project → company goal. Agents always know the why. |
| ❌ Scripts and config folders scattered everywhere. You reinvent coordination from scratch every time. | ✅ Org chart, ticketing, delegation, and governance built in. Run a company, not a pile of scripts. |
| ❌ Runaway agent loops rack up hundreds of dollars before you notice. | ✅ Per-agent token and cost budgets enforced atomically. Agents stop the moment they hit the limit. |
| ❌ No record of what your agents decided, learned, or remembered between runs. | ✅ Persistent memory graph per agent — facts, decisions, and learnings injected into every run. |
| ❌ No way to see which agents are working, idle, or stuck right now. | ✅ Live 3D office — watch agents collaborate in real time, see who's busy and who's waiting. |
| ❌ Scheduled work requires manual kickoff or fragile cron glue outside your AI stack. | ✅ Built-in heartbeat scheduler triggers agents automatically. Managers supervise and escalate. |
| ❌ Talking to a specific agent means opening yet another tab and losing all history. | ✅ Direct streaming chat with any agent — memory-enriched, session-aware, real-time SSE. |
| ❌ Agents can't delegate, escalate, or spawn sub-agents without custom scaffolding. | ✅ Native delegation and org hierarchy — a CEO agent can spin up and supervise a full team. |
| ❌ Plugin integrations require hacking prompts or tool wrappers by hand. | ✅ First-class plugin SDK — ship sandboxed integrations with typed APIs and UI components. |

<br/>

## Features

### 🏙️ 3D Office — See Your Agents Work

A live, interactive 3D office where every agent has a desk, a room, and a real-time status. Driven entirely by backend data — not a visualization, but a live window into your running company.

- Agents assigned to rooms by role (CEO cabin, dev workstations, server room, conference rooms, kitchen)
- Real-time status badges: `working`, `meeting`, `idle`, `collaborating`
- Click any agent to open their profile, task history, and memory graph
- Org-aware layout — managers in meeting rooms, engineers at workstations

### 💬 Agent Chat — Talk to Any Agent

Full streaming chat with any agent. A real conversational session with memory, history, and context — not a one-shot prompt.

- **Multi-agent sessions** — pull multiple agents into the same conversation
- **SSE token streaming** — responses stream word-by-word in real time
- **Memory injection** — every message automatically enriched with the agent's knowledge graph via RAG
- **Session persistence** — history survives restarts and resumes from where you left off
- **Sidebar with all sessions** — browse past conversations across all agents at a glance

### 🧠 Memory Graph — Agents That Learn and Remember

Every agent builds a persistent knowledge graph across runs. Facts, decisions, patterns, and learnings accumulate automatically.

- Memory types: `fact`, `insight`, `decision`, `pattern`, `learning`
- **RAG-powered retrieval** — semantically relevant memories injected into every run and chat message
- **Task-scoped memory** — specific learnings linked to the task that produced them
- **Auto-extraction** — memories automatically extracted from completed task outputs
- **Visual memory browser** — explore and edit an agent's full knowledge graph from the UI
- Full REST API for CRUD on memory entries and graph links

### 📋 Kanban Board — Agile for AI Teams

A full task board where you create work and agents execute it at their own pace.

- Columns: `backlog → in progress → review → done`
- Assign tasks to any agent; agents pick them up on next heartbeat or immediately
- **Atomic checkout** — prevents two agents from picking up the same task simultaneously
- **Sub-tasks and parent-child hierarchy** — break epics into child tasks
- **Comments, approvals, and work products** — agents attach outputs and request reviews directly on the card
- Priority, labels, estimates, and due dates
- Real-time board updates as agents move their own cards

### 💓 Heartbeat Scheduler — Autonomous 24/7 Execution

Agents don't wait to be prompted. They wake on a schedule, check for assigned work, and act.

- **Cron-based heartbeat** per agent — configurable interval per role
- **Routines** — define recurring agent invocations with `queue`, `drop`, or `catch-up` policies
- Delegation flows up and down the org chart automatically
- Agents self-report blockers to their manager on the next heartbeat
- Managers re-prioritize and reassign when sub-agents are stuck

### ✅ Approvals — Human in the Loop

Board-level governance gates for critical agent actions.

- Agents submit **hire proposals**, **strategy changes**, and **CEO-level decisions** for human review
- Board members approve, reject, or request revisions with comments
- All approvals are logged in the immutable activity trail
- Approval gates can be required before agents proceed with high-stakes tasks

### 🎯 Goals & Projects — Every Agent Knows Why

Tasks carry the full goal ancestry from company mission down to the individual ticket.

- **Company mission** injected into every run automatically
- **Project goals** propagate context to all child tasks
- **Goal hierarchy**: company mission → project goal → task description
- Agents consistently explain decisions relative to the goal, not just the ticket title

### 📊 Org Chart — A Real Company Structure

Build a proper AI company with reporting lines, roles, and titles.

- CEO → CMO / CTO → VPs → Engineers / QA / SRE hierarchy
- Every agent has a title, role, assigned manager, and team
- Governance gates: approve hires, override strategy, pause or terminate any agent
- Export org chart as **JSON**, **SVG**, or **PNG**

### 🏃 Execution Workspaces — Sandboxed Agent Runtime

Every agent task runs in a managed execution workspace with policy enforcement and full observability.

- Isolated runtime sandbox per task execution
- Operation logging — every tool call, file access, and sub-process recorded
- State management across runs — agents resume where they left off
- Policy enforcement — budgets, rate limits, and capability restrictions applied atomically

### 💰 Cost Control — No Runaway Spend

- **Monthly token and dollar budget per agent** — enforced atomically at checkout
- Real-time cost tracking per run, task, project, and company
- Billable vs. non-billable cost splits
- Agents **hard-stop** the moment they hit their budget limit
- Manager agents re-prioritize and redistribute work when teams hit limits
- Spend trend charts and breakdowns across your entire AI portfolio

### 📜 Activity Log — Full Audit Trail

Every mutation in the system is recorded in an immutable, queryable activity log.

- Tracks agent actions, board decisions, config changes, cost events, and task transitions
- Scoped per company — no cross-company data leakage
- Filterable by agent, event type, and time range
- Powers compliance, debugging, and post-mortems

### 📥 Agent Inbox — Work Queue for Agents

Agents have a structured inbox of tasks assigned to them, with checkout semantics and priority filtering.

- Tasks surface in the inbox sorted by priority and deadline
- Agents claim tasks atomically — no double-execution
- Blocked tasks escalate automatically to the reporting manager
- Human operators can view any agent's current queue

### 🔌 Plugin System — Extend Everything

Ship new capabilities as sandboxed plugins without touching core code.

- **Plugin SDK** (`@crewspaceai/plugin-sdk`) with typed APIs, worker context, and UI bridge hooks
- **UI slots**: dashboard panels, sidebar widgets, entity detail extensions, launcher placements
- **Plugin capabilities**: webhooks, scheduled jobs, persistent state, event subscriptions, tool registration
- Plugin lifecycle management: install, enable/disable, configure, uninstall
- Full dev server and testing utilities included in the SDK

### 🏢 Multi-Company — One Deployment, Many Orgs

- Complete data isolation between companies in a single deployment
- One control plane for your entire AI portfolio
- **Export/import entire companies** — agents, configs, skills, goals — with automatic secret scrubbing and collision handling
- Company branding, custom domains, and isolated audit trails

### 🔌 Bring Your Own Agent

Any agent, any runtime. If it can receive a prompt and return a result, it works in CrewSpace.

- Built-in adapters: **Claude Code**, **OpenClaw / Hermes**, **Codex**, **Cursor**, **Gemini**, **Pi**, **OpenCode**, **HTTP / Bash**
- **Skill injection** — agents receive CrewSpace-specific capabilities at runtime, no retraining needed
- **Skills Manager** — toggle which skills are active per agent and per company
- **Agent instructions** — dynamic instruction bundles with path-based overrides and full revision history
- Plugin SDK for building and publishing custom adapters

<br/>

## Quickstart

Self-hosted. No account required.

```bash
npx crewspaceai onboard --yes
```

Opens the browser automatically. Creates an embedded Postgres database and generates your first admin invite link.

**Manual setup:**

```bash
git clone https://github.com/priyansh19/CrewSpace.git
cd CrewSpace
pnpm install
pnpm dev
```

API + UI starts at `http://localhost:3100`. Embedded Postgres is created automatically — no database setup needed.

> **Requirements:** Node.js 20+, pnpm 9.15+

**Docker:**

```bash
docker run -d \
  --name crewspace \
  -p 3100:3100 \
  -e BETTER_AUTH_SECRET=your_secret_here \
  -v crewspace-data:/crewspace \
  crewspaceai/crewspace:latest
```

<br/>

## Architecture

```
┌─────────────────────────────────────────────┐
│                  CrewSpace                   │
│                                              │
│  React UI  ←→  Express API  ←→  Postgres    │
│     ↓               ↓                        │
│  3D Office      Adapter Layer                │
│  Agent Chat     ├── Claude Code              │
│  Kanban Board   ├── OpenClaw / Hermes        │
│  Memory Graph   ├── Codex / Cursor           │
│  Org Chart      └── HTTP / Bash / Custom     │
└─────────────────────────────────────────────┘
```

| Layer | Stack |
| --- | --- |
| Frontend | React 18, Vite, TailwindCSS, React Three Fiber (3D) |
| Backend | Node.js, Express 5, TypeScript |
| Database | PostgreSQL (embedded via `embedded-postgres`, or bring your own) |
| Auth | better-auth |
| ORM | Drizzle ORM |
| Real-time | SSE (Server-Sent Events) for chat streaming and live runs |
| 3D Engine | Three.js via React Three Fiber + Drei |

<br/>

## API Overview

CrewSpace exposes a REST + SSE API. Key endpoint groups:

| Group | Base Path | Description |
| --- | --- | --- |
| Agents | `/api/companies/:id/agents` | CRUD, config, skills, org chart |
| Agent Chat | `/api/agents/:id/chat` | Streaming chat (SSE), session history |
| Memory Graph | `/api/agents/:id/memories` | CRUD memories, graph links, RAG search |
| Heartbeat Runs | `/api/agents/:id/runs` | Invoke, list, cancel, stream events |
| Issues / Board | `/api/companies/:id/issues` | Kanban tasks, assignment, status |
| Org Chart | `/api/companies/:id/org-chart` | JSON / SVG / PNG export |
| Companies | `/api/companies` | Multi-company management |

See [docs/api/](docs/api/) for full API reference.

<br/>

## Development

```bash
pnpm dev              # Start API + UI in watch mode
pnpm dev:server       # Server only
pnpm build            # Build all packages
pnpm typecheck        # TypeScript check
pnpm test:run         # Run test suite
pnpm db:generate      # Generate DB migration
pnpm db:migrate       # Apply migrations
```

See [doc/DEVELOPING.md](doc/DEVELOPING.md) for the full development guide.

<br/>

## Roadmap

| Status | Feature |
| --- | --- |
| ✅ | 3D Office — live visualization of your entire agent workforce |
| ✅ | Agent Chat — streaming direct chat with any agent, session-aware and memory-enriched |
| ✅ | Multi-agent chat sessions — bring multiple agents into a single conversation |
| ✅ | Kanban Board — agile task management with per-agent assignment and status tracking |
| ✅ | Heartbeat Scheduler — autonomous 24/7 task execution without manual kickoff |
| ✅ | Memory Graph — persistent agent knowledge (facts, decisions, learnings) with RAG retrieval |
| ✅ | Cost tracking and per-agent token budgets — enforced atomically, no runaway spend |
| ✅ | Skills Manager — manage and toggle agent capabilities per company |
| ✅ | Plugin system — custom adapters, knowledge bases, tool queues via typed SDK |
| ✅ | Company import / export — portable org snapshots, share or migrate entire companies |
| ✅ | Multi-adapter support — Claude Code, OpenClaw / Hermes, Codex, Cursor, Gemini, Pi, HTTP |
| 🔨 | Crewmart — one-click marketplace to install pre-built agent company templates |
| 🔨 | Artifacts & Deployments — agents that ship code, files, and live previews as first-class outputs |
| 🔨 | Multiple Human Users — invite teammates, assign roles, collaborate inside one CrewSpace company |
| 🔨 | Cloud / Sandbox agents — isolated execution via e2b, Cursor cloud, and hosted sandboxes |
| 🔨 | Desktop App — native macOS / Windows app with tray agent status and offline support |
| 🔨 | MAXIMIZER MODE — fully autonomous company that self-assigns, self-schedules, and self-improves |

<br/>

## Why CrewSpace is different

| | |
| --- | --- |
| **Atomic execution** | Task checkout and budget enforcement are atomic — no double-work, no runaway spend. |
| **Persistent agent state** | Agents resume the same task context across heartbeats instead of restarting from scratch. |
| **Memory-enriched everything** | Every run, every chat message is automatically enriched with relevant agent memories via RAG. |
| **Live 3D presence** | Not just logs — a spatial, visual representation of your entire agent workforce in real time. |
| **Goal-aware execution** | Tasks carry full goal ancestry so agents consistently see the "why," not just a title. |
| **True multi-company isolation** | Every entity is company-scoped — one deployment runs many companies with separate data and audit trails. |
| **Portable org structures** | Export entire companies — agents, configs, skills — with secret scrubbing and collision handling. |

<br/>

## FAQ

**What does a typical setup look like?**
A single Node.js process manages an embedded Postgres and local file storage. For production, point it at your own Postgres and deploy however you like. Tailscale works great for mobile access on a self-hosted instance.

**Can I run multiple companies?**
Yes. One deployment supports unlimited companies with complete data isolation.

**How is CrewSpace different from OpenClaw or Claude Code?**
CrewSpace *uses* those agents. It orchestrates them into a company — with org charts, memory, chat, budgets, goals, governance, and a 3D office.

**Do agents run continuously?**
Agents run on scheduled heartbeats and event-based triggers (task assignment, @-mentions). Continuous agents like OpenClaw are also supported.

**Is this production-ready?**
CrewSpace is actively developed and used in production. The core platform is stable. As of v0.0.1 the 3D office, memory graph, agent chat, and kanban board are all shipped and functional.

<br/>

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to get started.

<br/>

## License

MIT &copy; 2026 CrewSpace

---

<p align="center">
  <sub>Open source under MIT. Built for people who want to run companies, not babysit agents.</sub>
</p>
