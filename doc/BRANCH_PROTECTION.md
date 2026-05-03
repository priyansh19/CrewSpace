# Branch Protection & Repository Security Setup

This document describes the branch protection rules, required status checks, and repository security settings that must be applied to the `priyansh19/CrewSpace` repository.

> **Note:** These settings require GitHub repository admin access. They cannot be applied via code changes alone and must be configured in the GitHub web UI or via the GitHub API with an admin token.

## 1. Branch Protection for `main`

Navigate to **Settings → Branches → Add rule** (or edit existing rule).

### Required settings

| Setting | Value | Reason |
|---------|-------|--------|
| Branch name pattern | `main` | Protect the default branch |
| Require a pull request before merging | ✅ Enabled | All changes must go through PR review |
| Require approvals | 1 | At least one reviewer required |
| Dismiss stale PR approvals when new commits are pushed | ✅ Enabled | Ensures reviewed code is what lands |
| Require review from CODEOWNERS | ✅ Enabled | Enforces ownership on sensitive files |
| Require status checks to pass before merging | ✅ Enabled | Blocks broken code |
| Status checks that are required | `policy`, `verify`, `e2e` | PR workflow jobs (see `.github/workflows/pr.yml`) |
| Require branches to be up to date before merging | ✅ Enabled | Prevents merge skew |
| Restrict pushes that create files matching configured patterns | ✅ (optional) | Block direct pushes to release infra |
| Do not allow bypassing the above settings | ✅ Enabled | Even admins must follow the rules |

### Required status checks (from `.github/workflows/pr.yml`)

- `policy` — validates Dockerfile deps, blocks manual lockfile edits
- `verify` — typecheck, tests, build, canary dry-run
- `e2e` — Playwright end-to-end tests

## 2. Branch Protection for `develop` (if used)

If the project adopts a `main` + `develop` branching model, apply the same rules to `develop` with these adjustments:

| Setting | Value |
|---------|-------|
| Branch name pattern | `develop` |
| Require approvals | 1 |
| Require status checks | `policy`, `verify` (e2e may be optional for develop) |

## 3. GitHub Environments

Create these deployment environments for the Release workflow:

### `npm-canary`

- **Required reviewers:** none
- **Wait timer:** none
- **Deployment branches:** `main` only

### `npm-stable`

- **Required reviewers:** at least 1 maintainer
- **Prevent self-review:** enabled
- **Wait timer:** optional (e.g., 5 minutes)
- **Deployment branches:** `main` only

These environments are referenced in `.github/workflows/release.yml`.

## 4. Repository Secrets

The following secrets should be configured in **Settings → Secrets and variables → Actions**:

| Secret | Required By | Purpose |
|--------|-------------|---------|
| `NPM_TOKEN` | `.github/workflows/release.yml` | npm publishing (legacy; prefer trusted publishing — see below) |
| `ANTHROPIC_API_KEY` | `.github/workflows/e2e.yml` | Optional — for LLM-dependent e2e tests |

### Trusted Publishing (recommended)

Instead of storing `NPM_TOKEN`, configure npm trusted publishing:

1. In npm package settings, add a trusted publisher for `priyansh19/CrewSpace`
2. Workflow: `.github/workflows/release.yml`
3. Leave npm environment field blank
4. Verify with a canary publish before revoking old tokens

See [doc/RELEASE-AUTOMATION-SETUP.md](RELEASE-AUTOMATION-SETUP.md) for the full trusted publishing guide.

## 5. Repository Rulesets (optional but recommended)

For stronger protection, create a ruleset that blocks direct pushes to:

- `.github/workflows/**`
- `scripts/release*`
- `docker/**`

Rulesets apply to all branches and cannot be bypassed by default.

## 6. Verification Checklist

After applying settings:

- [ ] Open a test PR — confirm required checks appear and block merge until passing
- [ ] Confirm CODEOWNERS review is required for `.github/workflows/release.yml`
- [ ] Run the Release workflow in dry-run mode — confirm `npm-canary` / `npm-stable` environments are used
- [ ] Verify canary publish succeeds under `npm-canary` environment
- [ ] Verify stable publish requires approval under `npm-stable` environment

## 7. Related Documentation

- [doc/RELEASE-AUTOMATION-SETUP.md](RELEASE-AUTOMATION-SETUP.md) — npm trusted publishing and release workflows
- [doc/RELEASING.md](RELEASING.md) — Release process for maintainers
- [doc/PUBLISHING.md](PUBLISHING.md) — npm package publishing details
