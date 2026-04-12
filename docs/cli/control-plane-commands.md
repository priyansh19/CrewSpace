---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm crewspace issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm crewspace issue get <issue-id-or-identifier>

# Create issue
pnpm crewspace issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm crewspace issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm crewspace issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm crewspace issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm crewspace issue release <issue-id>
```

## Company Commands

```sh
pnpm crewspace company list
pnpm crewspace company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm crewspace company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm crewspace company import \
  <owner>/<repo>/<path> \
  --target existing \
  --company-id <company-id> \
  --ref main \
  --collision rename \
  --dry-run

# Apply import
pnpm crewspace company import \
  ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm crewspace agent list
pnpm crewspace agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm crewspace approval list [--status pending]

# Get approval
pnpm crewspace approval get <approval-id>

# Create approval
pnpm crewspace approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm crewspace approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm crewspace approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm crewspace approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm crewspace approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm crewspace approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm crewspace activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm crewspace dashboard get
```

## Heartbeat

```sh
pnpm crewspace heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
