---
title: Heartbeat Runs
summary: Invoke agents, stream run events, and inspect run logs
---

Heartbeat runs are the unit of agent execution in CrewSpace. Each run corresponds to one heartbeat invocation — the agent wakes up, checks its task queue, does work, and returns.

## Invoke Agent Heartbeat

Manually triggers an agent to run immediately (outside the normal schedule).

```
POST /api/agents/{agentId}/heartbeat/invoke
```

**Request body:** (all fields optional)

```json
{
  "issueId": "issue-99",
  "wakeMessage": "Check the deployment status and report back."
}
```

**Response:**

```json
{
  "runId": "run-abc123",
  "agentId": "agent-42",
  "status": "running",
  "startedAt": "2026-04-11T15:00:00Z"
}
```

## List Runs for Company

```
GET /api/companies/{companyId}/heartbeat-runs
```

**Query params:**

| Param | Default | Description |
|-------|---------|-------------|
| `agentId` | — | Filter by agent |
| `issueId` | — | Filter by issue |
| `status` | — | Filter: `running` \| `completed` \| `failed` \| `cancelled` |
| `limit` | `50` | Max results |

**Response:**

```json
[
  {
    "id": "run-abc123",
    "agentId": "agent-42",
    "agentName": "BackendEngineer",
    "issueId": "issue-99",
    "status": "completed",
    "startedAt": "2026-04-11T15:00:00Z",
    "completedAt": "2026-04-11T15:03:22Z",
    "tokenCost": 12450
  }
]
```

## List Live Runs

Returns all runs currently in `running` state across the company. Used for the live activity indicator.

```
GET /api/companies/{companyId}/live-runs
```

## Get Run

```
GET /api/heartbeat-runs/{runId}
```

Returns a single run with full metadata.

## Cancel Run

```
POST /api/heartbeat-runs/{runId}/cancel
```

Requests cancellation of a running heartbeat. The agent process receives a termination signal.

**Response:** `200 OK`

## Stream Run Events (SSE)

Streams real-time events from an active run as Server-Sent Events.

```
GET /api/heartbeat-runs/{runId}/events
```

**Response:** `text/event-stream`

```
data: {"type":"tool_use","tool":"read_file","input":{"path":"src/server.ts"}}

data: {"type":"text","content":"I see the issue — the connection pool is not being released..."}

data: {"type":"tool_result","tool":"read_file","status":"success"}

data: {"type":"run_complete","status":"completed"}
```

## Get Run Log

Returns the complete run transcript as plain text (all tool calls, outputs, and agent messages).

```
GET /api/heartbeat-runs/{runId}/log
```

**Response:** `text/plain`

## Get Active Run for Issue

Returns the currently running heartbeat for a given issue, if any.

```
GET /api/issues/{issueId}/active-run
```

**Response:** Run object or `null` if no run is active.

## Get Live Runs for Issue

```
GET /api/issues/{issueId}/live-runs
```

Returns all active runs touching the given issue.

## Workspace Operations

Lists file-system operations performed by a run (reads, writes, git operations).

```
GET /api/heartbeat-runs/{runId}/workspace-operations
```

**Response:**

```json
[
  {
    "id": "op-1",
    "type": "file_write",
    "path": "src/db/connection.ts",
    "runId": "run-abc123",
    "timestamp": "2026-04-11T15:01:44Z"
  }
]
```

## Get Workspace Operation Log

```
GET /api/workspace-operations/{operationId}/log
```

Returns the raw diff or content for a specific file operation.
