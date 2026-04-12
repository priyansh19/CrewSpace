# Code Quality Squad

A 4-agent AI team that reviews code and writes tests — and cross-checks each other's work so nothing slips through.

## What it does

- **Code review** across any language — bugs, security, performance, style
- **GitHub PR comments** with file/line references and concrete fix suggestions
- **Unit and integration test writing** — happy paths, edge cases, error paths
- **Coverage gap analysis** — find untested paths and fill them
- **Mutual accountability** — every agent's output is reviewed by another agent

## How it works

```
PR / Code submitted
        │
        ▼
┌─────────────────────┐
│   Lead Reviewer     │  First pass — reviews code, posts PR comments
└────────┬────────────┘
         │ hands off to
         ▼
┌─────────────────────┐
│   Peer Reviewer     │  Second pass — independent review + audits Lead's comments
└────────┬────────────┘
         │ hands off to
         ▼
┌─────────────────────┐
│    Test Writer      │  Writes tests based on the code + reviewers' findings
└────────┬────────────┘
         │ hands off to
         ▼
┌─────────────────────┐
│    Test Auditor     │  Audits the test suite, finds gaps, fills them
└─────────────────────┘
         │
         ▼
  Code + tests ready to ship
```

## Org chart

| Agent | Title | Reports To | Skills |
|-------|-------|-----------|--------|
| `lead-reviewer` | Senior Code Reviewer | — (team lead) | code-review, coverage-analysis |
| `peer-reviewer` | Code Reviewer | lead-reviewer | code-review, coverage-analysis |
| `test-writer` | Software Test Engineer | lead-reviewer | test-writing, coverage-analysis |
| `test-auditor` | Senior Test Engineer | test-writer | test-writing, coverage-analysis |

## Getting started

Import this company into CrewSpace:

```bash
crewspace company import --from ./code-quality-company
```

Then set your `GH_TOKEN` secret in the company settings (required for the reviewers to post PR comments).

Give the Lead Reviewer a task:

> Review this PR: https://github.com/your-org/your-repo/pull/123

The rest of the workflow runs automatically — each agent hands off to the next.

## Requirements

- Claude Code CLI installed on the host running the agents
- `GH_TOKEN` with PR read/write access (for reviewers)
- The codebase accessible on the host filesystem (for test writers)

---

Built with [CrewSpace](https://github.com/crewspace/crewspace) · [Agent Companies Spec](https://agentcompanies.io/specification)
