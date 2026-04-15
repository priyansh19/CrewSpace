---
title: Memory Graph
summary: Agent memory CRUD, knowledge graph, cross-agent links, and RAG task search
---

The Memory Graph stores persistent knowledge for agents — facts, insights, decisions, and solutions — and links them into a queryable graph. Agents read memory context automatically during chat and heartbeat runs.

## Get Memory Graph

```
GET /api/companies/{companyId}/memories/graph
```

Returns all memory nodes and their links for the company. Used to render the 3D memory graph in the UI.

**Response:**

```json
{
  "memories": [
    {
      "id": "mem-1",
      "title": "RAG chunking strategy",
      "content": "512 tokens with 64-token overlap yields best retrieval scores",
      "memoryType": "learning",
      "companyId": "company-1",
      "agents": [{ "agentId": "agent-42", "isOwner": true }],
      "tags": ["rag", "embeddings"],
      "importance": 0.85,
      "createdAt": "2026-04-01T10:00:00Z"
    }
  ],
  "links": [
    {
      "id": "link-1",
      "sourceMemoryId": "mem-1",
      "targetMemoryId": "mem-2",
      "linkType": "related"
    }
  ]
}
```

## Create Memory

```
POST /api/companies/{companyId}/memories
```

**Request body:**

```json
{
  "title": "Azure AKS cluster topology",
  "content": "Two node pools: standard-d4s-v3 (system) and Standard_NC6 (GPU). GPU pool is spot instances.",
  "memoryType": "fact",
  "agentIds": ["agent-infra-1"],
  "tags": ["azure", "aks", "infrastructure"],
  "importance": 0.9
}
```

**Memory types:** `fact` | `insight` | `decision` | `pattern` | `learning` | `task`

**Response:** `201 Created` with the memory object.

## Update Memory

```
PATCH /api/memories/{memoryId}
```

**Request body:** Any subset of `title`, `content`, `tags`, `importance`, `metadata`.

**Response:** Updated memory object.

## Delete Memory

```
DELETE /api/memories/{memoryId}
```

**Response:** `204 No Content`

## Create Memory Link

Links two memory nodes together in the knowledge graph.

```
POST /api/companies/{companyId}/memories/links
```

**Request body:**

```json
{
  "sourceMemoryId": "mem-1",
  "targetMemoryId": "mem-2",
  "linkType": "related"
}
```

**Link types:** `related` | `derived_from` | `contradicts` | `supports` | `precedes`

**Response:** `201 Created` with the link object.

## Delete Memory Link

```
DELETE /api/memories/links/{linkId}
```

**Response:** `204 No Content`

## Store Task Solution

Records a completed task as a reusable memory so future agents can learn from it.

```
POST /api/companies/{companyId}/task-solutions
```

**Request body:**

```json
{
  "agentId": "agent-42",
  "issueId": "issue-99",
  "title": "Fixed N+1 query in user feed endpoint",
  "content": "Added .includes(:posts) to the User query. Reduced DB calls from 51 to 2.",
  "tags": ["performance", "database", "rails"]
}
```

**Response:** `201 Created` with the memory object (`memoryType: "task"`).

## Search Similar Tasks (RAG)

Finds memories relevant to a query using keyword scoring. Used internally by agents during chat and heartbeats to inject relevant context.

```
GET /api/agents/{agentId}/similar-tasks?q={query}
```

**Query params:**

| Param | Description |
|-------|-------------|
| `q` | Natural language query string |

**Response:**

```json
[
  {
    "id": "mem-55",
    "title": "Fixed N+1 query in user feed endpoint",
    "content": "Added .includes(:posts) to the User query...",
    "memoryType": "task"
  }
]
```

Returns up to 3 memories sorted by relevance score.
