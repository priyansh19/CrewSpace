# Design: AgentDetail Layout Fix + Agent Proposals Publishing Flow

**Date:** 2026-05-15  
**Branch:** crewspace-ai/jolly-mayer-d2db18

---

## Part 1: AgentDetail Page Horizontal Layout Fix

### Problem

`desktop-electron/src/renderer/pages/AgentDetail.tsx` root div has only `space-y-6` with no max-width or centering. On wider windows the content stretches edge-to-edge, with the header section (avatar, name, action buttons) appearing cramped against the edges of the padded main area.

The `<main>` in `Layout.tsx:418` applies `px-6 py-5 md:px-10 md:py-6` which gives outer padding, but the page content still expands to fill the entire remaining width.

### Fix

Add `max-w-5xl mx-auto` to the root `div` in `AgentDetail.tsx`:

```tsx
// Before
<div className={cn("space-y-6", isMobile && showConfigActionBar && "pb-24")}>

// After
<div className={cn("max-w-5xl mx-auto space-y-6", isMobile && showConfigActionBar && "pb-24")}>
```

`max-w-5xl` (1024px) is chosen because AgentDetail has richer content (config editor, skills list, runs) than `IssueDetail` (`max-w-2xl`) but doesn't need to be unconstrained. This is consistent with `ProjectDetail` which uses `max-w-4xl` for its main sections.

### Affected Files

- `desktop-electron/src/renderer/pages/AgentDetail.tsx` — line 818

---

## Part 2: Agent Proposals Publishing Flow

### Problem

When an agent is asked to create and publish proposals (e.g. "create launch plans"), it posts the content as task comments instead of publishing to the `feature_proposals` table. The `IntelligenceProposals` page (`/intelligence/proposals`) shows only entries from that table, so agent-generated proposals never appear there.

**Root cause:** The `crewspaceai` CLI (the agent's primary interface to the CrewSpace API) has no `proposal` command. Agents know how to call `crewspaceai issue create` for tasks, but there is no equivalent for proposals.

### Architecture

```
Agent (Claude Code / CLI)
  └── crewspaceai proposal create --title "..." --description "..." [--category ui|backend|infra|ux|other] [--priority high|normal|low]
        └── POST /api/companies/:companyId/feature-proposals
              └── feature_proposals table (status: "pending")
                    └── IntelligenceProposals page — swipe card review UI
```

### Fix — Two Parts

#### A. New CLI command: `crewspaceai proposal create`

New file: `cli/src/commands/client/proposal.ts`

Registers `crewspaceai proposal create` with these options:
- `--title <title>` (required)
- `--description <text>` (required)  
- `--category <category>` — one of: `ui`, `backend`, `infra`, `ux`, `other` (default: `other`)
- `--priority <priority>` — one of: `high`, `normal`, `low` (default: `normal`)
- `--proposed-by-agent-id <id>` — agent ID proposing this (optional, agents may pass their own ID)
- `--json` — output created proposal as JSON

The command calls `POST /api/companies/:companyId/feature-proposals` using the shared `ctx.api` client (same auth/baseURL pattern as `issue.ts`).

Register in `cli/src/index.ts` alongside other client commands.

#### B. Update CEO `AGENTS.md`

Add a section to `server/src/onboarding-assets/ceo/AGENTS.md` explaining:
- When producing strategic plans, launch proposals, or feature ideas for board review → use `crewspaceai proposal create`
- These appear in the Proposals page for human review (not in task comments)
- Example invocation with all flags

### Affected Files

- `cli/src/commands/client/proposal.ts` — new file
- `cli/src/index.ts` — register `registerProposalCommands`
- `server/src/onboarding-assets/ceo/AGENTS.md` — add proposal publishing instructions

### Out of Scope

- Changing proposal review workflow (swipe UI stays as-is)
- Adding `proposal list` / `proposal get` commands (not needed for the publishing flow)
- Real-time UI refresh on new proposal (IntelligenceProposals already polls via React Query)
