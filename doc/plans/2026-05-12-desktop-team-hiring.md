# Desktop Team Hiring Plan

**Date:** 2026-05-12
**Requested by:** Board
**Approved by:** Mark (CEO)

## Situation

The CrewSpace desktop app (`desktop-electron/`) is functional but pre-production. It builds a Windows NSIS installer, bundles the server, and has a first-run onboarding wizard. However, several gaps block a production release:

- No code signing (enterprise environments block the unsigned exe)
- No macOS support
- No auto-updater
- No crash reporting
- Security model not formally audited
- Icon asset too small for `electron-builder`

## Team structure

Hiring **3 agents** under the CTO line (or directly under CEO until CTO is hired):

```
CEO (Mark)
└── Desktop Lead (engineer, claude_local)
    ├── Desktop Platform (engineer, codex_local)
    └── Desktop UI (engineer, claude_local)
```

## Roles

### 1. Desktop Lead
- **Why**: Someone needs to own the architecture and manage the other two. Electron main process security is high-stakes.
- **Adapter**: `claude_local` — strong reasoning for security audits and cross-platform strategy.
- **Budget**: $500/month

### 2. Desktop Platform
- **Why**: Build engineering is a distinct skill from UI development. Code signing, notarization, and CI/CD require specialized knowledge.
- **Adapter**: `codex_local` — excellent for build scripts, tooling, and infrastructure automation.
- **Budget**: $400/month

### 3. Desktop UI
- **Why**: Desktop-native UX (tray, notifications, window chrome) is different from web UX. Needs an engineer who thinks in native desktop patterns.
- **Adapter**: `claude_local` — good at UI/UX design reasoning and renderer-process development.
- **Budget**: $400/month

## Initial project

**Desktop App Production Hardening**

5 starter tasks created and assigned:

| Task | Assignee | Priority |
|---|---|---|
| Harden Electron security model | Desktop Lead | High |
| Add macOS build target and notarization | Desktop Platform | High |
| Implement auto-updater | Desktop Platform | Medium |
| Redesign onboarding for desktop-native UX | Desktop UI | Medium |
| Add system tray status and quick actions | Desktop UI | Medium |

## How to import

The team is packaged as a portable CrewSpace import at `doc/plans/desktop-team/`.

```bash
# From repo root, with CrewSpace running
npx crewspace company import doc/plans/desktop-team --yes
```

Or import selectively via the board UI.

## Risks

- **Code signing cost**: Apple Developer Program + OV certificate are recurring costs. Board approval may be needed.
- **macOS hardware**: We need a Mac for notarization testing. Can use GitHub Actions macOS runners for CI.
- **Server coupling**: Desktop app bundles the server; server breaking changes can break the desktop build. Coordination with the server team required.

## Next steps

1. Board confirms budget for code signing certificates.
2. Import the team into the active CrewSpace company.
3. Desktop Lead checks out the security audit task first.
4. Mark checks in after 1 week for status and blockers.
