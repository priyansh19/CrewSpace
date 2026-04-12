---
title: Docker
summary: Docker Compose quickstart
---

Run CrewSpace in Docker without installing Node or pnpm locally.

## Compose Quickstart (Recommended)

```sh
docker compose -f docker/docker-compose.quickstart.yml up --build
```

Open [http://localhost:3100](http://localhost:3100).

Defaults:

- Host port: `3100`
- Data directory: `./data/docker-crewspace`

Override with environment variables:

```sh
CREWSPACE_PORT=3200 CREWSPACE_DATA_DIR=../data/pc \
  docker compose -f docker/docker-compose.quickstart.yml up --build
```

**Note:** `CREWSPACE_DATA_DIR` is resolved relative to the compose file (`docker/`), so `../data/pc` maps to `data/pc` in the project root.

## Manual Docker Build

```sh
docker build -t crewspace-local .
docker run --name crewspace \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e CREWSPACE_HOME=/crewspace \
  -v "$(pwd)/data/docker-crewspace:/crewspace" \
  crewspace-local
```

## Data Persistence

All data is persisted under the bind mount (`./data/docker-crewspace`):

- Embedded PostgreSQL data
- Uploaded assets
- Local secrets key
- Agent workspace data

## Claude and Codex Adapters in Docker

The Docker image pre-installs:

- `claude` (Anthropic Claude Code CLI)
- `codex` (OpenAI Codex CLI)

Pass API keys to enable local adapter runs inside the container:

```sh
docker run --name crewspace \
  -p 3100:3100 \
  -e HOST=0.0.0.0 \
  -e CREWSPACE_HOME=/crewspace \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-... \
  -v "$(pwd)/data/docker-crewspace:/crewspace" \
  crewspace-local
```

Without API keys, the app runs normally — adapter environment checks will surface missing prerequisites.
