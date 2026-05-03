# Deployment Runbook

This document describes how to deploy CrewSpace to various environments.

## Prerequisites

- Docker and Docker Compose (for local/self-hosted)
- kubectl and access to a Kubernetes cluster (for K8s deployments)
- Terraform and AWS credentials (for AWS/EKS deployments)
- GitHub Container Registry access (`ghcr.io/priyansh19/crewspace`)

## Deployment Options

### 1. Docker Compose (Quickstart)

Single container with embedded SQLite/Postgres. Best for local evaluation.

```bash
cd docker
BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose -f docker-compose.quickstart.yml up --build
```

### 2. Docker Compose (Full Stack with PostgreSQL)

Multi-container setup with external PostgreSQL database.

```bash
cd docker
BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  docker compose up --build
```

The full stack includes:
- `crewspace-db` — PostgreSQL 17 with health checks
- `crewspace` — CrewSpace server with health checks and rolling restart on DB recovery

### 3. Podman Quadlet (systemd)

For systemd-based Linux hosts using Podman.

```bash
# Copy quadlet files
cp docker/quadlet/*.pod docker/quadlet/*.container \
  ~/.config/containers/systemd/

# Create secrets env file
cat > ~/.config/containers/systemd/crewspace.env <<EOL
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
POSTGRES_USER=crewspace
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=crewspace
DATABASE_URL=postgres://crewspace:${POSTGRES_PASSWORD}@127.0.0.1:5432/crewspace
EOL

# Start
systemctl --user daemon-reload
systemctl --user start crewspace-pod
```

### 4. Kubernetes (Kustomize)

#### Staging

```bash
cd k8s/overlays/staging
# Update secret values
kubectl apply -k .
```

#### Production

```bash
cd k8s/overlays/production
# Update secret values and domain
kubectl apply -k .
```

**Prerequisites:**
- A Kubernetes cluster with ingress-nginx and cert-manager installed
- Update `REPLACE_ME` placeholders in base manifests before deploying
- Generate secrets: `openssl rand -hex 32` for `BETTER_AUTH_SECRET` and `CREWSPACE_AGENT_JWT_SECRET`

### 5. AWS EKS (Terraform)

#### Bootstrap Terraform state

```bash
# Create S3 bucket and DynamoDB table for Terraform state
aws s3 mb s3://crewspace-terraform-state --region us-east-1
aws dynamodb create-table \
  --table-name crewspace-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

#### Deploy staging

```bash
cd terraform/environments/staging
terraform init
terraform plan
terraform apply
```

#### Deploy production

```bash
cd terraform/environments/production
terraform init
terraform plan
terraform apply
```

**Post-Terraform steps:**
1. Update kubeconfig: `aws eks update-kubeconfig --name crewspace-staging`
2. Deploy K8s manifests (see Kubernetes section above)
3. Configure DNS for ACM certificate validation
4. Update `CREWSPACE_PUBLIC_URL` in ConfigMap to match your domain

## Secrets Management

### Required Secrets

| Secret | Generate With | Used In |
|--------|---------------|---------|
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32` | All deployments |
| `CREWSPACE_AGENT_JWT_SECRET` | `openssl rand -hex 32` | All deployments |
| `POSTGRES_PASSWORD` | `openssl rand -hex 16` | Docker Compose, K8s, Quadlet |
| `DATABASE_URL` | Construct from postgres creds | Docker Compose, K8s, Quadlet |

### GitHub Actions Secrets

Configure in **Settings → Secrets and variables → Actions**:

- `NPM_TOKEN` — for npm publishing (legacy; prefer trusted publishing)
- `ANTHROPIC_API_KEY` — optional, for e2e tests with LLM assertions

## Database Backups

### Local / Docker Compose

PostgreSQL data persists in named volumes:
- `pgdata` — PostgreSQL data directory
- `crewspace-data` — CrewSpace application data

### Kubernetes

PostgreSQL runs as a StatefulSet with a PVC. Set up Velero or a CronJob for automated backups:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: crewspace-db-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: pgdump
              image: postgres:17-alpine
              command:
                - sh
                - -c
                - |
                  pg_dump \
                    -h crewspace-db \
                    -U crewspace \
                    crewspace > /backup/crewspace-$(date +%Y%m%d-%H%M%S).sql
              env:
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: crewspace-db-secrets
                      key: POSTGRES_PASSWORD
              volumeMounts:
                - name: backup
                  mountPath: /backup
          volumes:
            - name: backup
              persistentVolumeClaim:
                claimName: backup-pvc
          restartPolicy: OnFailure
```

## Health Checks

All deployment methods include health checks:

- **Application**: `GET /api/health` on port 3100
- **PostgreSQL**: `pg_isready -U crewspace -d crewspace`

## Troubleshooting

### Container fails to start with database connection errors

Ensure the database container is healthy before the app starts:
- Docker Compose: uses `depends_on` with `condition: service_healthy`
- Kubernetes: init containers or readiness probes ensure ordering
- Quadlet: `After=` dependency on DB unit; expect one or two restart attempts on first boot

### Image pull errors in Kubernetes

Ensure your cluster has access to `ghcr.io/priyansh19/crewspace`:

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  --namespace=crewspace
```

Then add `imagePullSecrets` to the Deployment spec.

## Blue-Green Deployment

For zero-downtime deployments in production:

1. Apply the green deployment with a new image tag
2. Wait for green pods to be ready
3. Update the Service selector to point to green
4. Verify green is serving traffic
5. Scale down blue deployment

A future enhancement is to add a `rollout` script that automates this via `kubectl`.

## Related Documentation

- [doc/DOCKER.md](DOCKER.md) — Docker build and local run details
- [doc/BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) — CI/CD pipeline setup
- [doc/RELEASE-AUTOMATION-SETUP.md](RELEASE-AUTOMATION-SETUP.md) — npm publishing setup
