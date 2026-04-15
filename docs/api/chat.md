---
title: Agent Chat
summary: Streaming SSE chat with individual agents, backed by agent instructions and memory RAG
---

The Agent Chat API lets you send multi-turn messages to an agent and stream its responses as Server-Sent Events. Responses are generated using the agent's instructions bundle and enriched with relevant memories from the Memory Graph.

## Stream Chat Message

```
POST /api/agents/{agentId}/chat
```

Sends a message (with optional conversation history) to the agent and streams the response as SSE tokens.

**Request body:**

```json
{
  "messages": [
    { "role": "user", "content": "What's the status of the Azure cluster migration?" },
    { "role": "assistant", "content": "We completed the system node pool migration last week..." },
    { "role": "user", "content": "What's left to migrate?" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `Array<{role, content}>` | Yes | Full conversation history. Last entry is the new user message. Maximum 12 messages used for context. |

**Response:** `text/event-stream`

Each SSE event carries a JSON chunk:

```
data: {"t":"The remaining"}

data: {"t":" GPU node pool"}

data: {"t":" needs to be migrated."}

data: [DONE]
```

| Event data | Meaning |
|-----------|---------|
| `{"t":"<chunk>"}` | Text token chunk — append to display buffer |
| `[DONE]` | Stream complete |

### How it works

1. Loads the agent's instructions bundle (AGENTS.md / system prompt)
2. Injects relevant memories from the Memory Graph (RAG via keyword scoring)
3. Includes up to 12 prior messages as conversation context
4. Streams the response token by token so the first chunk appears in ~1–2s

### Error responses

```json
{ "error": "messages array required" }   // 400 — body missing messages
{ "error": "Agent not found" }           // 404 — agentId doesn't exist
```

## Task Sessions

Lists the task-backed conversation sessions for an agent. Each session corresponds to an issue the agent is working on.

```
GET /api/agents/{agentId}/task-sessions
```

**Response:**

```json
[
  {
    "sessionId": "session-abc",
    "issueId": "issue-99",
    "issueTitle": "Migrate GPU node pool to AKS",
    "status": "in_progress",
    "lastActivity": "2026-04-11T14:22:00Z"
  }
]
```

## Reset Agent Session

Clears the agent's in-memory session state (useful after a stuck or corrupted run).

```
POST /api/agents/{agentId}/runtime-state/reset-session
```

**Response:** `200 OK`
