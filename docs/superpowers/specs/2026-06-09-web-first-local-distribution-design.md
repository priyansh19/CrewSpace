# CrewSpace — Web-First Local Distribution Design

**Date:** 2026-06-09  
**Status:** Approved  
**Author:** Priyansh Gupta

---

## Summary

Reposition CrewSpace from an Electron desktop app to a **local-first developer tool** distributed via npm and standalone binaries. Users install once, run a single command, and access the full product at `localhost:3100` in their browser. The Electron app is preserved on `desktop-app-preserved` branch for future revisit.

---

## Goals

- Zero cloud infrastructure costs — everything runs on the user's machine
- Reach developers via `npm install -g crewspace`
- Reach non-developers via a one-click binary download
- Keep all local adapters (Claude, Gemini, Cursor, Codex, etc.) fully intact
- Eliminate SSL/code-signing complexity from the distribution path
- Provide a public landing page (crewspace.ai) as the front door

## Non-Goals

- Cloud-hosted SaaS version (deferred)
- User accounts, authentication, or multi-tenancy on a hosted server
- Mobile support
- Removing or modifying any existing local adapter

---

## Architecture

```
User's Machine
├── crewspace (npm global package OR standalone binary)
│   ├── CLI entry point  →  parses commands (start, stop, status, update, doctor)
│   ├── Express server   →  existing @crewspaceai/server (port 3100, default)
│   ├── Embedded PostgreSQL  →  existing embedded-postgres setup
│   ├── Local adapters   →  all existing adapters unchanged
│   └── Bundled React UI →  existing renderer-dist served as static files
└── Browser             →  http://localhost:3100  (auto-opened on first start)
```

The core server, database, adapters, and UI are **unchanged**. Only the distribution layer is new.

---

## Distribution Channels

### Channel 1 — npm Package

- **Package name:** `crewspace`
- **Install:** `npm install -g crewspace`
- **Entry:** `crewspace` CLI command available globally after install
- **Node requirement:** ≥20 (same as existing server)
- **Published to:** npmjs.com

### Channel 2 — Standalone Binary

- **Targets:** Windows (`.exe`), macOS (universal), Linux (x64)
- **Bundler:** `caxa` or `pkg` — bundles Node runtime + server + UI
- **Distribution:** GitHub Releases + crewspace.ai download page
- **Signing:** Windows binary signed via SignPath Foundation (free, open source)
- **No prerequisites:** users need nothing installed

---

## CLI Package (`packages/cli`)

New workspace package added to the monorepo.

### Commands

| Command | Description |
|---|---|
| `crewspace start` | Start the server, open browser at localhost:3100 |
| `crewspace stop` | Stop the running server |
| `crewspace status` | Show server status, port, data directory |
| `crewspace update` | Check for and apply latest version |
| `crewspace doctor` | Check system health (node version, port conflicts, db status) |

### Package Structure

```
packages/cli/
├── src/
│   ├── index.ts        — entry point, command router
│   ├── commands/
│   │   ├── start.ts    — start server, open browser, handle port conflicts
│   │   ├── stop.ts     — graceful shutdown
│   │   ├── status.ts   — report running state
│   │   ├── update.ts   — check npm/github for newer version, self-update
│   │   └── doctor.ts   — system checks and diagnostics
│   └── utils/
│       ├── pid.ts      — PID file management for start/stop
│       ├── port.ts     — port availability checking
│       └── browser.ts  — cross-platform browser open
├── package.json        — name: "crewspace", bin: { crewspace: "./dist/index.js" }
└── tsconfig.json
```

### Start Behaviour

1. Check if already running (PID file) → warn if so
2. Check port 3100 availability → increment to 3101, 3102 if taken
3. Spawn server process (detached, log to `~/.crewspace/logs/server.log`)
4. Wait for health check at `/api/health`
5. Open browser at `http://localhost:<port>`
6. Print status summary to terminal

---

## Landing Page (crewspace.ai)

Static marketing site hosted on existing VPS. No backend.

### Content

- **Hero:** one-line description + install command (`npm install -g crewspace && crewspace start`)
- **Download section:** Windows / macOS / Linux binary buttons (links to GitHub Releases)
- **Quickstart:** 3 steps — install, run, open browser
- **Feature highlights:** local adapters, embedded DB, 3D workspace, open source
- **GitHub link**

### Tech

- Plain HTML/CSS or a minimal static site generator (Astro recommended)
- Deployed via GitHub Actions to VPS on push to `main`
- No framework, no JS bundle, fast load

---

## Release Pipeline Changes

Updated GitHub Actions workflow on tag push:

```
1. Build server + UI (existing steps)
2. Bundle UI into server/ui-dist (existing)
3. npm publish → npmjs.com  (new)
4. Build standalone binaries via caxa (new)
   ├── windows-x64.exe
   ├── macos-universal
   └── linux-x64
5. Upload binaries → GitHub Release (updated)
6. Submit windows binary to SignPath Foundation for signing (new)
7. Deploy updated crewspace.ai download links (new)
```

---

## What Changes vs What Stays

| Component | Status | Notes |
|---|---|---|
| `server/` | ✅ Unchanged | Core Express server |
| `packages/db/` | ✅ Unchanged | Embedded postgres |
| `packages/adapters/` | ✅ Unchanged | All local adapters |
| `desktop-electron/` | 🔒 Preserved | `desktop-app-preserved` branch |
| `packages/cli/` | 🆕 New | Distribution CLI |
| `.github/workflows/release-desktop.yml` | 🔄 Updated | Add npm publish + binary build |
| `crewspace.ai` | 🆕 New | Static landing page |
| `pnpm-workspace.yaml` | 🔄 Updated | Add `packages/cli` |

---

## Open Questions (Resolved)

- **Local adapters:** All kept, unchanged
- **API keys:** Not applicable — local-first, user configures their own keys in the app
- **Data storage:** `~/.crewspace/` (existing embedded postgres setup)
- **Port:** Default 3100, auto-increment on conflict
- **Auto-update:** `crewspace update` command + notification on start if outdated

---

## Implementation Order

1. `packages/cli` — core CLI with `start` and `stop`
2. Release pipeline — npm publish + binary build
3. Landing page — crewspace.ai static site
4. Polish — `update`, `doctor`, `status` commands
5. SignPath Foundation signing setup for Windows binary
