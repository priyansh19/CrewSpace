# Security and Compliance

This document outlines the security posture of CrewSpace and required configurations for production deployments.

## Authentication and Authorization

CrewSpace supports two runtime modes:

- `local_trusted` — loopback-only, no login required (development only)
- `authenticated` — login required via Better Auth (production)

### Production Requirements

- Always use `authenticated` mode for production
- Set `CREWSPACE_DEPLOYMENT_EXPOSURE` to `private` (VPN/Tailscale) or `public` (internet-facing)
- Configure `CREWSPACE_PUBLIC_URL` explicitly for public deployments
- Use strong `BETTER_AUTH_SECRET` (generate with `openssl rand -hex 32`)

## Secrets Management

### Required Secrets

| Secret | Generation | Storage |
|--------|-----------|---------|
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` | Environment variable / K8s secret |
| `CREWSPACE_AGENT_JWT_SECRET` | `openssl rand -hex 32` | Environment variable / K8s secret |
| `POSTGRES_PASSWORD` | `openssl rand -hex 16` | Environment variable / K8s secret |
| `DATABASE_URL` | Construct from credentials | Environment variable / K8s secret |

### Rules

- Never commit secrets to version control
- Use `.env` files only for local development (already in `.gitignore`)
- Rotate secrets quarterly
- Use Kubernetes secrets or a secrets manager (AWS Secrets Manager, HashiCorp Vault) in production

## Network Security

### Docker Compose

- Server binds to `0.0.0.0` inside container but is only exposed on host port `3100`
- PostgreSQL is not exposed to host — only accessible within Docker network

### Kubernetes

- Use NetworkPolicies to restrict pod-to-pod communication (future enhancement)
- Ingress uses TLS via cert-manager + Let's Encrypt
- Consider a WAF (AWS WAF, Cloudflare) for public-facing deployments

### GitHub Security

- Branch protection enabled on `main`
- Required status checks: `policy`, `verify`, `e2e`
- CODEOWNERS enforced for release infrastructure
- Dependabot configured for dependency updates

## Dependency Security

### Current Measures

- `pnpm audit` runs implicitly via CI
- `.github/workflows/pr.yml` validates lockfile integrity
- `scripts/check-forbidden-tokens.mjs` prevents accidental secret commits

### Recommendations

- Enable GitHub Dependabot alerts
- Run `pnpm audit --fix` regularly
- Pin Docker base images to specific digests for reproducibility

## Data Protection

### Database

- PostgreSQL data encrypted at rest via volume encryption (AWS EBS, GCP PD)
- Backups encrypted and stored in a separate account/region
- See [doc/DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) for backup procedures

### Log Redaction

CrewSpace implements log redaction for sensitive fields. See `server/src/log-redaction.ts`.

## Compliance Checklist

- [ ] All secrets stored outside version control
- [ ] Production uses `authenticated` mode
- [ ] TLS enabled for all external traffic
- [ ] Database encrypted at rest
- [ ] Regular backups tested
- [ ] Dependency scanning enabled
- [ ] Branch protection with required checks
- [ ] Admin access restricted (no direct pushes to `main`)
- [ ] Audit logging enabled (future: integrate with SIEM)

## Incident Response

1. **Detection**: Prometheus alerts → PagerDuty/Opsgenie (to be configured)
2. **Containment**: Scale down affected pods, revoke compromised secrets
3. **Investigation**: Check logs via Loki/CloudWatch
4. **Recovery**: Apply fixes, rotate secrets, redeploy
5. **Post-mortem**: Document in issue tracker

## Related

- [doc/DEPLOYMENT_MODES.md](DEPLOYMENT_MODES.md) — Authentication and deployment mode details
- [doc/DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) — Backup and recovery procedures
