# AgentDetail Layout Fix + Agent Proposals Publishing Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix AgentDetail page horizontal spacing and add a `crewspaceai proposal create` CLI command so agents can publish proposals directly to the Proposals page instead of posting them as task comments.

**Architecture:** Two independent changes — (1) a one-line CSS fix on the AgentDetail root container, (2) a new CLI command module `cli/src/commands/client/proposal.ts` registered in `cli/src/index.ts`, and a CEO AGENTS.md update to document the command.

**Tech Stack:** React + Tailwind CSS (desktop-electron), TypeScript + Commander.js (CLI)

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `desktop-electron/src/renderer/pages/AgentDetail.tsx:818` | Add `max-w-5xl mx-auto` to root div |
| Create | `cli/src/commands/client/proposal.ts` | `crewspaceai proposal create` command |
| Modify | `cli/src/index.ts` | Register `registerProposalCommands` |
| Modify | `server/src/onboarding-assets/ceo/AGENTS.md` | Document proposal publishing |

---

## Task 1: Fix AgentDetail horizontal layout

**Files:**
- Modify: `desktop-electron/src/renderer/pages/AgentDetail.tsx:818`

- [ ] **Step 1: Apply the fix**

In `desktop-electron/src/renderer/pages/AgentDetail.tsx`, find line 818:

```tsx
// Before
<div className={cn("space-y-6", isMobile && showConfigActionBar && "pb-24")}>

// After
<div className={cn("max-w-5xl mx-auto space-y-6", isMobile && showConfigActionBar && "pb-24")}>
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd desktop-electron && pnpm typecheck 2>&1 | tail -5
```

Expected: no errors (this is a className string change only).

- [ ] **Step 3: Commit**

```bash
git add desktop-electron/src/renderer/pages/AgentDetail.tsx
git commit -m "fix(desktop): constrain AgentDetail to max-w-5xl with mx-auto centering"
```

---

## Task 2: Add `crewspaceai proposal create` CLI command

**Files:**
- Create: `cli/src/commands/client/proposal.ts`
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Create `cli/src/commands/client/proposal.ts`**

```typescript
import { Command } from "commander";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface ProposalCreateOptions extends BaseClientOptions {
  companyId?: string;
  title: string;
  description: string;
  category?: string;
  priority?: string;
  proposedByAgentId?: string;
}

interface FeatureProposal {
  id: string;
  companyId: string;
  proposedByAgentId: string | null;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdIssueId: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export function registerProposalCommands(program: Command): void {
  const proposal = program.command("proposal").description("Feature proposal operations");

  addCommonClientOptions(
    proposal
      .command("create")
      .description("Publish a feature proposal for board review")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--title <title>", "Proposal title")
      .requiredOption("--description <text>", "Proposal description")
      .option(
        "--category <category>",
        "Category: ui, backend, infra, ux, other (default: other)",
      )
      .option(
        "--priority <priority>",
        "Priority: high, normal, low (default: normal)",
      )
      .option("--proposed-by-agent-id <id>", "Agent ID submitting this proposal")
      .action(async (opts: ProposalCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const payload = {
            title: opts.title,
            description: opts.description,
            category: opts.category ?? "other",
            priority: opts.priority ?? "normal",
            proposedByAgentId: opts.proposedByAgentId ?? null,
          };
          const created = await ctx.api.post<FeatureProposal>(
            `/api/companies/${ctx.companyId}/feature-proposals`,
            payload,
          );
          if (ctx.json) {
            printOutput(created, { json: true });
            return;
          }
          console.log(
            formatInlineRecord({
              id: created.id,
              title: created.title,
              category: created.category,
              priority: created.priority,
              status: created.status,
            }),
          );
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );
}
```

- [ ] **Step 2: Register the command in `cli/src/index.ts`**

Add the import after the existing client command imports (around line 17):

```typescript
import { registerProposalCommands } from "./commands/client/proposal.js";
```

Then call it alongside the other register calls. Find the block of `register*Commands(program)` calls and add:

```typescript
registerProposalCommands(program);
```

- [ ] **Step 3: Typecheck the CLI**

```bash
cd cli && pnpm typecheck 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Smoke-test the command help**

```bash
cd cli && pnpm exec ts-node --esm src/index.ts proposal create --help 2>&1 || node dist/index.js proposal create --help 2>&1 | head -20
```

Expected output should include `--title`, `--description`, `--category`, `--priority`, `--proposed-by-agent-id` options.

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/client/proposal.ts cli/src/index.ts
git commit -m "feat(cli): add crewspaceai proposal create command"
```

---

## Task 3: Document proposal publishing in CEO AGENTS.md

**Files:**
- Modify: `server/src/onboarding-assets/ceo/AGENTS.md`

- [ ] **Step 1: Add a Proposals section to AGENTS.md**

Open `server/src/onboarding-assets/ceo/AGENTS.md`. After the `## What you DO personally` section, insert:

```markdown
## Publishing Proposals

When you produce a strategic plan, launch plan, or feature idea that the board should review, **publish it as a proposal** — do NOT put it in a task comment.

```bash
crewspaceai proposal create \
  --title "Short title describing the proposal" \
  --description "Full details of what you're proposing and why" \
  --category other \
  --priority normal
```

Categories: `ui`, `backend`, `infra`, `ux`, `other`  
Priorities: `high`, `normal`, `low`

Published proposals appear in the **Proposals** page for the board to review and accept or reject. Accepted proposals automatically become issues in the backlog.

If you are creating multiple related proposals (e.g. several launch plans), run the command once per proposal so they appear as separate cards.
```

- [ ] **Step 2: Commit**

```bash
git add server/src/onboarding-assets/ceo/AGENTS.md
git commit -m "docs(ceo): document crewspaceai proposal create for publishing plans"
```

---

## Self-Review

**Spec coverage:**
- [x] AgentDetail `max-w-5xl mx-auto` fix — Task 1
- [x] `crewspaceai proposal create` CLI command with all flags — Task 2
- [x] Register command in `cli/src/index.ts` — Task 2, Step 2
- [x] CEO AGENTS.md documents the command with example — Task 3

**Placeholder scan:** No TBDs, no "add appropriate error handling", all code blocks complete.

**Type consistency:** `FeatureProposal` interface defined in Task 2 Step 1; used in same file only. `formatInlineRecord`, `handleCommandError`, `printOutput`, `resolveCommandContext`, `addCommonClientOptions` — all imported from `./common.js`, matching the pattern in `approval.ts` and `issue.ts`.
