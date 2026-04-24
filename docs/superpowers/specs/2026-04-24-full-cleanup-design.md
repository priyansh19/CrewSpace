# Full Codebase Cleanup — Design Spec
**Date:** 2026-04-24  
**Branch:** `chore/full-cleanup` off `feat/memory-graph-3d-rotation`  
**Scope:** Dead files + unused TS code + unused npm packages

---

## Approach

Hybrid: automated tooling (`knip`, `depcheck`) for discovery, manual review before deletion. Three phases committed independently. Verify after each phase.

---

## Phase 1 — Dead Files

**Tool:** Manual  
**Verify:** `pnpm typecheck`

Delete:
- Stale git worktree: `.claude/worktrees/laughing-hoover` via `git worktree remove --force`
- `releases/v0.2.7.md`, `releases/v0.3.0.md`, `releases/v0.3.1.md`, `releases/v2026.318.0.md`, `releases/v2026.325.0.md` (keep `releases/` dir)
- `ISSUES_DRAFT.md`
- `doc/README-draft.md`
- `.env.docker` (verify no references first)

Keep intact: `doc/`, `docs/`, `evals/`, all runtime source, all packages.

---

## Phase 2 — Dead TypeScript Code

**Tool:** `knip` (monorepo-aware)  
**Verify:** `pnpm typecheck` + `pnpm test:run`

Steps:
1. Install `knip` as dev dependency at root
2. Configure `knip.config.ts` for pnpm workspaces — point at each package's entry points
3. Run `knip --reporter compact` — review output
4. Delete only files/exports confirmed dead (not dynamic requires, not re-exports needed for public API)
5. Re-run `knip` until clean

Knip targets: unused files, unused exports, unused types, duplicate exports.

---

## Phase 3 — Unused npm Packages

**Tool:** `depcheck` per package  
**Verify:** `pnpm build` + `pnpm test:run`

Packages to audit:
- `server/`
- `ui/`
- `cli/`
- `packages/db/`
- `packages/shared/`
- `packages/adapter-utils/`
- `packages/adapters/claude-local/`
- `packages/adapters/codex-local/`
- `packages/adapters/cursor-local/`
- `packages/adapters/gemini-local/`
- `packages/adapters/openclaw-gateway/`
- `packages/adapters/opencode-local/`
- `packages/adapters/pi-local/`
- `packages/adapters/hermes-crewspace-adapter/`

Steps:
1. Install `depcheck` globally or via `npx`
2. Run per package, collect unused deps
3. Cross-check against actual imports (depcheck has false positives with peer deps and dynamic requires)
4. Remove confirmed unused deps from `package.json`
5. Run `pnpm install` to update lockfile

---

## Constraints

- `doc/`, `docs/`, `evals/` directories: read-only — no deletion
- `releases/` directory: keep directory, contents deleted
- Each phase gets its own commit on `chore/full-cleanup`
- No force-pushing, no skipping type-check

---

## Success Criteria

- `pnpm typecheck` passes after Phase 1 and 2
- `pnpm test:run` passes after Phase 2 and 3
- `pnpm build` passes after Phase 3
- `knip` reports zero unused exports/files
- `depcheck` reports zero unused dependencies per package
