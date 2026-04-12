---
title: Environment Variables
summary: Full environment variable reference
---

All environment variables that CrewSpace uses for server configuration.

## Server Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `HOST` | `127.0.0.1` | Server host binding |
| `DATABASE_URL` | (embedded) | PostgreSQL connection string |
| `CREWSPACE_HOME` | `~/.crewspace` | Base directory for all CrewSpace data |
| `CREWSPACE_INSTANCE_ID` | `default` | Instance identifier (for multiple local instances) |
| `CREWSPACE_DEPLOYMENT_MODE` | `local_trusted` | Runtime mode override |

## Secrets

| Variable | Default | Description |
|----------|---------|-------------|
| `CREWSPACE_SECRETS_MASTER_KEY` | (from file) | 32-byte encryption key (base64/hex/raw) |
| `CREWSPACE_SECRETS_MASTER_KEY_FILE` | `~/.crewspace/.../secrets/master.key` | Path to key file |
| `CREWSPACE_SECRETS_STRICT_MODE` | `false` | Require secret refs for sensitive env vars |

## Agent Runtime (Injected into agent processes)

These are set automatically by the server when invoking agents:

| Variable | Description |
|----------|-------------|
| `CREWSPACE_AGENT_ID` | Agent's unique ID |
| `CREWSPACE_COMPANY_ID` | Company ID |
| `CREWSPACE_API_URL` | CrewSpace API base URL |
| `CREWSPACE_API_KEY` | Short-lived JWT for API auth |
| `CREWSPACE_RUN_ID` | Current heartbeat run ID |
| `CREWSPACE_TASK_ID` | Issue that triggered this wake |
| `CREWSPACE_WAKE_REASON` | Wake trigger reason |
| `CREWSPACE_WAKE_COMMENT_ID` | Comment that triggered this wake |
| `CREWSPACE_APPROVAL_ID` | Resolved approval ID |
| `CREWSPACE_APPROVAL_STATUS` | Approval decision |
| `CREWSPACE_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs |

## LLM Provider Keys (for adapters)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude Local adapter) |
| `OPENAI_API_KEY` | OpenAI API key (for Codex Local adapter) |
