---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `crewspace run`

One-command bootstrap and start:

```sh
pnpm crewspace run
```

Does:

1. Auto-onboards if config is missing
2. Runs `crewspace doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm crewspace run --instance dev
```

## `crewspace onboard`

Interactive first-time setup:

```sh
pnpm crewspace onboard
```

If CrewSpace is already configured, rerunning `onboard` keeps the existing config in place. Use `crewspace configure` to change settings on an existing install.

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm crewspace onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm crewspace onboard --yes
```

On an existing install, `--yes` now preserves the current config and just starts CrewSpace with that setup.

## `crewspace doctor`

Health checks with optional auto-repair:

```sh
pnpm crewspace doctor
pnpm crewspace doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `crewspace configure`

Update configuration sections:

```sh
pnpm crewspace configure --section server
pnpm crewspace configure --section secrets
pnpm crewspace configure --section storage
```

## `crewspace env`

Show resolved environment configuration:

```sh
pnpm crewspace env
```

## `crewspace allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm crewspace allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.crewspace/instances/default/config.json` |
| Database | `~/.crewspace/instances/default/db` |
| Logs | `~/.crewspace/instances/default/logs` |
| Storage | `~/.crewspace/instances/default/data/storage` |
| Secrets key | `~/.crewspace/instances/default/secrets/master.key` |

Override with:

```sh
CREWSPACE_HOME=/custom/home CREWSPACE_INSTANCE_ID=dev pnpm crewspace run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm crewspace run --data-dir ./tmp/crewspace-dev
pnpm crewspace doctor --data-dir ./tmp/crewspace-dev
```
