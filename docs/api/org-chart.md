---
title: Org Chart
summary: Agent hierarchy, reporting lines, and org chart export
---

The Org Chart API returns the company's agent hierarchy — who reports to whom, roles, and statuses — for use in the 3D office view and the org chart visualization.

## Get Org Chart Data

```
GET /api/companies/{companyId}/org
```

Returns the full agent hierarchy as a JSON tree with reporting relationships.

**Response:**

```json
{
  "agents": [
    {
      "id": "agent-1",
      "name": "Alex Mercer",
      "role": "ceo",
      "title": "Chief Executive Officer",
      "reportsTo": null,
      "status": "working",
      "directReports": ["agent-2", "agent-3"]
    },
    {
      "id": "agent-2",
      "name": "Leo Zhang",
      "role": "manager",
      "title": "Chief Technology Officer",
      "reportsTo": "agent-1",
      "directReports": ["agent-4", "agent-5"]
    }
  ]
}
```

## Export Org Chart as SVG

```
GET /api/companies/{companyId}/org.svg
```

Returns the org chart as a scalable vector graphic suitable for embedding or download.

**Response:** `image/svg+xml`

## Export Org Chart as PNG

```
GET /api/companies/{companyId}/org.png
```

Returns the org chart as a PNG image.

**Query params:**

| Param | Default | Description |
|-------|---------|-------------|
| `width` | `1200` | Output width in pixels |
| `height` | `800` | Output height in pixels |

**Response:** `image/png`

## Get Agent Configurations (Bulk)

Returns adapter configuration summaries for all agents in the company. Used by the 3D office view to display agent status badges.

```
GET /api/companies/{companyId}/agent-configurations
```

**Response:**

```json
[
  {
    "agentId": "agent-1",
    "adapterType": "claude-local",
    "status": "working",
    "currentIssueId": "issue-99",
    "lastHeartbeat": "2026-04-11T15:03:00Z"
  }
]
```
