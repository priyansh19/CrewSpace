# CrewSpace

## 0.0.1

### Initial Release

- **Memory Graph** — persistent agent knowledge graph with fact / insight / decision / pattern / learning memory types. RAG-powered retrieval injects semantically relevant memories into every run and chat message. Task-solution memory stores successful approaches for reuse. Visual memory browser in the UI for exploring an agent's full knowledge graph. REST API for full CRUD on entries and graph links.
- **Agent Chat** — full streaming SSE chat interface for any agent. Multi-agent sessions, memory-enriched responses, session persistence, ChatSidebar with history. Dedicated full-page AgentChat interface alongside the embedded panel.
- **3D Office** — live Three.js / React Three Fiber 3D visualization of the agent workforce. Rooms: CEO cabin, dev workstations, server room, conference rooms, kitchen. Real-time agent status and positioning driven by live backend data.
- **Kanban Board** — agile task board with drag-and-drop, status columns (backlog, in progress, review, done), agent assignment, priority, labels, and real-time card movement.
- **Multi-agent session management** — CEO / CTO / CMO hierarchy with org chart. Agents self-report blockers up the chain; managers delegate down.
- **Org Chart API** — export org chart as JSON, SVG, or PNG from `/api/companies/:id/org-chart`.
- **Heartbeat Runs API** — invoke, list, cancel, stream events, and fetch logs for any agent run.
- **Bring Your Own Agent** — built-in adapters for Claude Code, OpenClaw / Hermes, Codex, Cursor, Gemini, Pi, HTTP, and Bash. Plugin SDK for custom adapters.
- **Goal Alignment** — every task carries full company mission → project goal → task ancestry so agents always know the why.
- **Cost Control** — per-agent monthly token budgets enforced atomically. Agents hard-stop at the limit.
- **Multi-Company** — one deployment, many companies. Complete data isolation per company.
- **Governance** — approve hires, override strategy, pause or terminate any agent at any time.
- **Portable Companies** — export / import entire org structures with agent configs, skills, and secret scrubbing.
- **Heartbeat Scheduler** — cron-based autonomous execution per agent. Delegation flows up and down the org chart.

### Dependencies

- @crewspaceai/adapter-utils@0.0.1
- @crewspaceai/adapter-claude-local@0.0.1
- @crewspaceai/adapter-codex-local@0.0.1
- @crewspaceai/adapter-cursor-local@0.0.1
- @crewspaceai/adapter-gemini-local@0.0.1
- @crewspaceai/adapter-openclaw-gateway@0.0.1
- @crewspaceai/adapter-opencode-local@0.0.1
- @crewspaceai/adapter-pi-local@0.0.1
- hermes-crewspace-adapter@0.0.1
- @crewspaceai/db@0.0.1
- @crewspaceai/shared@0.0.1
- @crewspaceai/server@0.0.1
- @crewspaceai/ui@0.0.1
