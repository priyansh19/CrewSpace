# Monitoring, Logging, and Error Tracking

This document describes how to set up monitoring, logging, and error tracking for CrewSpace.

## Health Endpoint

CrewSpace exposes a health check endpoint:

```
GET /api/health
```

This is used by:
- Docker Compose health checks
- Kubernetes liveness and readiness probes
- Load balancer health checks

## Prometheus + Grafana (Kubernetes)

### Prerequisites

- Prometheus Operator installed in the cluster
- Grafana instance (can be part of kube-prometheus-stack)

### Setup

1. Apply the ServiceMonitor:

   ```bash
   kubectl apply -f k8s/base/servicemonitor.yaml
   ```

2. Apply alerting rules:

   ```bash
   kubectl apply -f k8s/base/prometheusrule.yaml
   ```

3. Import the CrewSpace Grafana dashboard (see `monitoring/grafana-dashboard.json` — to be created once metrics are instrumented).

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| CrewSpaceDown | Health endpoint fails for 1m | critical |
| CrewSpaceHighErrorRate | 5xx rate > 5% for 2m | warning |
| CrewSpaceDatabaseDown | PostgreSQL unreachable for 1m | critical |

## Error Tracking (Sentry)

### Setup

1. Create a Sentry project at https://sentry.io
2. Add the DSN to environment variables:

   ```bash
   SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
   ```

3. Future enhancement: instrument the server to capture exceptions and send them to Sentry.

## Logging

### Docker Compose / Local

Logs go to stdout/stderr by default. View with:

```bash
docker compose logs -f crewspace
docker compose logs -f crewspace-db
```

### Kubernetes

```bash
kubectl logs -f deployment/crewspace -n crewspace
kubectl logs -f statefulset/crewspace-db -n crewspace
```

### Structured Logging

CrewSpace uses structured logging. Future enhancement: add JSON log formatting for ingestion into Loki, Datadog, or CloudWatch.

## Log Retention

| Environment | Retention | Notes |
|-------------|-----------|-------|
| Local / Docker | Container lifetime | Use `docker compose logs` or bind-mount log directory |
| Kubernetes | Configured at cluster level | Typically 7-30 days depending on storage |
| AWS CloudWatch | 30 days default | If using Fluent Bit / CloudWatch agent |

## Recommended Monitoring Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Metrics | Prometheus + Grafana | Application and infrastructure metrics |
| Logs | Loki or CloudWatch | Centralized log aggregation |
| Traces | Jaeger or AWS X-Ray | Distributed tracing (future) |
| Errors | Sentry | Error tracking and alerting |
| Uptime | UptimeRobot or Pingdom | External health checks |

## Related

- [doc/DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) — Deployment and infrastructure
- [doc/BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) — CI/CD pipeline
