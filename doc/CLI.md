# CLI Reference

CrewSpace CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm crewspace --help
```

First-time local bootstrap + run:

```sh
pnpm crewspace run
```

Choose local instance:

```sh
pnpm crewspace run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `crewspace onboard` and `crewspace configure --section server` set deployment mode in config
- runtime can override mode with `CREWSPACE_DEPLOYMENT_MODE`
- `crewspace run` and `crewspace doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm crewspace allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.crewspace`:

```sh
pnpm crewspace run --data-dir ./tmp/crewspace-dev
pnpm crewspace issue list --data-dir ./tmp/crewspace-dev
```

## Context Profiles

Store local defaults in `~/.crewspace/context.json`:

```sh
pnpm crewspace context set --api-base http://localhost:3100 --company-id <company-id>
pnpm crewspace context show
pnpm crewspace context list
pnpm crewspace context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm crewspace context set --api-key-env-var-name CREWSPACE_API_KEY
export CREWSPACE_API_KEY=...
```

## Company Commands

```sh
pnpm crewspace company list
pnpm crewspace company get <company-id>
pnpm crewspace company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm crewspace company delete PAP --yes --confirm PAP
pnpm crewspace company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `CREWSPACE_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `CREWSPACE_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm crewspace issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm crewspace issue get <issue-id-or-identifier>
pnpm crewspace issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm crewspace issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm crewspace issue comment <issue-id> --body "..." [--reopen]
pnpm crewspace issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm crewspace issue release <issue-id>
```

## Agent Commands

```sh
pnpm crewspace agent list --company-id <company-id>
pnpm crewspace agent get <agent-id>
pnpm crewspace agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a CrewSpace agent:

- creates a new long-lived agent API key
- installs missing CrewSpace skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `CREWSPACE_API_URL`, `CREWSPACE_COMPANY_ID`, `CREWSPACE_AGENT_ID`, and `CREWSPACE_API_KEY`

Example for shortname-based local setup:

```sh
pnpm crewspace agent local-cli codexcoder --company-id <company-id>
pnpm crewspace agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm crewspace approval list --company-id <company-id> [--status pending]
pnpm crewspace approval get <approval-id>
pnpm crewspace approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm crewspace approval approve <approval-id> [--decision-note "..."]
pnpm crewspace approval reject <approval-id> [--decision-note "..."]
pnpm crewspace approval request-revision <approval-id> [--decision-note "..."]
pnpm crewspace approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm crewspace approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm crewspace activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm crewspace dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm crewspace heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.crewspace/instances/default`:

- config: `~/.crewspace/instances/default/config.json`
- embedded db: `~/.crewspace/instances/default/db`
- logs: `~/.crewspace/instances/default/logs`
- storage: `~/.crewspace/instances/default/data/storage`
- secrets key: `~/.crewspace/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
CREWSPACE_HOME=/custom/home CREWSPACE_INSTANCE_ID=dev pnpm crewspace run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm crewspace configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
