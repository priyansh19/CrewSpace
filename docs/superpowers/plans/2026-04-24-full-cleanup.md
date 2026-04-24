# Full Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead files, unused TypeScript code, and unused npm packages across the entire CrewSpace monorepo.

**Architecture:** Three sequential phases on branch `chore/full-cleanup`. Phase 1 deletes dead files manually. Phase 2 uses `knip` to find and remove unused TypeScript exports/files. Phase 3 uses `depcheck` to remove unused npm packages. Each phase is committed independently with verification.

**Tech Stack:** knip (TS dead code), depcheck (unused npm deps), pnpm workspaces, TypeScript, Vitest

---

## Task 1: Create cleanup branch

**Files:** none

- [ ] **Step 1: Create branch off current**

```bash
cd /path/to/crewspace
git checkout -b chore/full-cleanup
```

Expected: `Switched to a new branch 'chore/full-cleanup'`

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `chore/full-cleanup`

---

## Task 2: Remove stale git worktree

**Files:**
- Remove: `.claude/worktrees/laughing-hoover/` (entire directory via git worktree)

- [ ] **Step 1: List worktrees to confirm stale one**

```bash
git worktree list
```

Expected output includes:
```
.../crewspace/.claude/worktrees/laughing-hoover  177d9dca [claude/laughing-hoover]
```

- [ ] **Step 2: Remove the worktree**

```bash
git worktree remove .claude/worktrees/laughing-hoover --force
```

Expected: no output, directory gone.

- [ ] **Step 3: Prune worktree refs**

```bash
git worktree prune
git worktree list
```

Expected: only the main worktree listed.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove stale laughing-hoover worktree"
```

---

## Task 3: Delete dead files

**Files:**
- Delete: `releases/v0.2.7.md`, `releases/v0.3.0.md`, `releases/v0.3.1.md`, `releases/v2026.318.0.md`, `releases/v2026.325.0.md`
- Delete: `ISSUES_DRAFT.md`
- Delete: `doc/README-draft.md`
- Delete: `.env.docker` (duplicate of `docker/.env`, no code references)

- [ ] **Step 1: Delete release files (keep directory)**

```bash
rm releases/v0.2.7.md releases/v0.3.0.md releases/v0.3.1.md releases/v2026.318.0.md releases/v2026.325.0.md
```

- [ ] **Step 2: Delete draft docs**

```bash
rm ISSUES_DRAFT.md doc/README-draft.md
```

- [ ] **Step 3: Delete duplicate env file**

```bash
rm .env.docker
```

- [ ] **Step 4: Verify no code references to deleted files**

```bash
grep -r "ISSUES_DRAFT\|README-draft\|\.env\.docker" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.sh" --include="*.yml" . | grep -v node_modules | grep -v ".git"
```

Expected: no output.

- [ ] **Step 5: Typecheck to confirm nothing broke**

```bash
pnpm typecheck
```

Expected: exits 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete dead files (drafts, stale release notes, duplicate env)"
```

---

## Task 4: Install and configure knip

**Files:**
- Modify: `package.json` (root) — add knip dev dependency
- Create: `knip.config.ts` (root)

- [ ] **Step 1: Install knip at root**

```bash
pnpm add -D knip --workspace-root
```

Expected: knip added to root `package.json` devDependencies.

- [ ] **Step 2: Create knip config**

Create file `knip.config.ts` at repo root:

```typescript
import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        'scripts/**/*.ts',
        'scripts/**/*.mjs',
        'vitest.config.ts',
      ],
      ignore: [
        'node_modules/**',
        'dist/**',
        '.claude/**',
        '.agents/**',
        'skills/**',
        'doc/**',
        'docs/**',
        'evals/**',
        'releases/**',
        'report/**',
      ],
    },
    'server': {
      entry: ['src/index.ts', 'src/app.ts', 'scripts/**/*.ts'],
    },
    'ui': {
      entry: ['src/main.tsx', 'src/App.tsx'],
    },
    'cli': {
      entry: ['src/index.ts'],
    },
    'packages/db': {
      entry: ['src/index.ts'],
    },
    'packages/shared': {
      entry: ['src/index.ts'],
    },
    'packages/adapter-utils': {
      entry: ['src/index.ts'],
    },
    'packages/adapters/claude-local': {
      entry: ['src/index.ts', 'src/server/index.ts', 'src/ui/index.ts', 'src/cli/index.ts'],
    },
    'packages/adapters/codex-local': {
      entry: ['src/index.ts', 'src/server/index.ts', 'src/ui/index.ts'],
    },
    'packages/adapters/cursor-local': {
      entry: ['src/index.ts', 'src/server/index.ts', 'src/ui/index.ts'],
    },
    'packages/adapters/gemini-local': {
      entry: ['src/index.ts', 'src/server/index.ts', 'src/ui/index.ts'],
    },
    'packages/adapters/hermes-crewspace-adapter': {
      entry: ['src/index.ts'],
    },
    'packages/adapters/openclaw-gateway': {
      entry: ['src/index.ts', 'src/server/index.ts', 'src/ui/index.ts'],
    },
    'packages/adapters/opencode-local': {
      entry: ['src/index.ts', 'src/server/index.ts', 'src/ui/index.ts'],
    },
    'packages/adapters/pi-local': {
      entry: ['src/index.ts', 'src/server/index.ts', 'src/ui/index.ts'],
    },
    'packages/plugins/sdk': {
      entry: [
        'src/index.ts',
        'src/protocol.ts',
        'src/types.ts',
        'src/ui/index.ts',
        'src/testing.ts',
        'src/bundlers.ts',
        'src/dev-server.ts',
      ],
    },
  },
};

export default config;
```

- [ ] **Step 3: Add knip script to root package.json**

In `package.json` scripts section, add:

```json
"knip": "knip"
```

- [ ] **Step 4: Commit config**

```bash
git add knip.config.ts package.json pnpm-lock.yaml
git commit -m "chore: add knip config for dead code detection"
```

---

## Task 5: Run knip and remove dead TS code

**Files:** Various — determined by knip output

- [ ] **Step 1: Run knip in report mode**

```bash
pnpm knip --reporter compact 2>&1 | tee /tmp/knip-report.txt
cat /tmp/knip-report.txt
```

Review all output carefully before deleting anything.

- [ ] **Step 2: Evaluate each flagged item**

For each item knip reports, apply this decision matrix:

| Flag type | Action |
|-----------|--------|
| Unused file | Delete if not dynamically imported or auto-discovered |
| Unused export | Remove `export` keyword from declaration |
| Unused type | Remove type if not used as public API |
| Unused dependency | Skip — handled in Phase 3 |
| False positive: dynamic `import()` | Add to `knip.config.ts` `ignore` array |
| False positive: re-export for public API | Add to entry points in knip config |

- [ ] **Step 3: Fix false positives in knip config first**

If knip flags items that are actually used (e.g., via dynamic import, config discovery, or plugin loading), add them to `knip.config.ts`:

```typescript
// Example: ignore dynamically loaded route files
'server': {
  entry: ['src/index.ts', 'src/app.ts', 'src/routes/*.ts'],
}
```

Re-run `pnpm knip --reporter compact` after each config change until only genuine dead code remains.

- [ ] **Step 4: Delete genuinely unused files**

For each confirmed unused file from knip output (example — your actual list will differ):

```bash
# Delete each confirmed unused file, e.g.:
rm ui/src/components/SomeUnusedComponent.tsx
rm server/src/routes/some-unused-route.ts
```

Do NOT delete files in: `node_modules/`, `dist/`, `.claude/`, `doc/`, `docs/`, `evals/`

- [ ] **Step 5: Remove unused exports**

For each file flagged for unused exports, open the file and remove the `export` keyword from unused declarations. Example:

```typescript
// Before
export function unusedHelper() { ... }

// After
function unusedHelper() { ... }
```

If the function itself is also unused after removing export, delete it entirely.

- [ ] **Step 6: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0. Fix any errors before continuing.

- [ ] **Step 7: Run tests**

```bash
pnpm test:run
```

Expected: all tests pass. Fix any regressions before continuing.

- [ ] **Step 8: Re-run knip to confirm clean**

```bash
pnpm knip --reporter compact
```

Expected: zero or only known false-positive output.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: remove dead TypeScript code and unused exports (knip)"
```

---

## Task 6: Audit unused npm packages with depcheck

**Files:**
- Modify: `package.json` in each package that has unused deps
- Modify: `pnpm-lock.yaml` (auto-updated by `pnpm install`)

- [ ] **Step 1: Install depcheck globally**

```bash
npm install -g depcheck
```

- [ ] **Step 2: Run depcheck on each package**

Run and capture output per package:

```bash
cd server && depcheck --ignores="tsx,@types/*" 2>&1 | tee /tmp/depcheck-server.txt; cd ..
cd ui && depcheck --ignores="@types/*,vite,tailwindcss" 2>&1 | tee /tmp/depcheck-ui.txt; cd ..
cd cli && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-cli.txt; cd ..
cd packages/db && depcheck --ignores="@types/*,drizzle-kit" 2>&1 | tee /tmp/depcheck-db.txt; cd ../..
cd packages/shared && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-shared.txt; cd ../..
cd packages/adapter-utils && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-adapter-utils.txt; cd ../..
cd packages/adapters/claude-local && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-claude.txt; cd ../../..
cd packages/adapters/codex-local && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-codex.txt; cd ../../..
cd packages/adapters/cursor-local && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-cursor.txt; cd ../../..
cd packages/adapters/gemini-local && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-gemini.txt; cd ../../..
cd packages/adapters/openclaw-gateway && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-openclaw.txt; cd ../../..
cd packages/adapters/opencode-local && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-opencode.txt; cd ../../..
cd packages/adapters/pi-local && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-pi.txt; cd ../../..
cd packages/adapters/hermes-crewspace-adapter && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-hermes.txt; cd ../../..
cd packages/plugins/sdk && depcheck --ignores="@types/*" 2>&1 | tee /tmp/depcheck-sdk.txt; cd ../../..
```

- [ ] **Step 3: Review all depcheck output**

Read each `/tmp/depcheck-*.txt` file. For each "Unused dependencies" entry, verify by:

1. Searching the source for actual usage: `grep -r "packageName" src/ --include="*.ts" --include="*.tsx"`
2. Checking if it's a peer dependency (keep those)
3. Checking if it's used in config files (vite.config, drizzle.config, etc.)
4. Checking if it's used only in tests (still remove from `dependencies`, move to `devDependencies` if needed)

Apply this decision matrix:

| depcheck says | Action |
|---------------|--------|
| Unused dependency | Remove from `dependencies`/`devDependencies` |
| Peer dep of another pkg | Keep |
| Used in config file only | Keep |
| Used via dynamic string import | Keep |
| False positive | Keep, note why |

- [ ] **Step 4: Remove confirmed unused packages**

For each confirmed unused package, edit the relevant `package.json`. Example — your actual list will differ based on depcheck output:

```json
// Remove from "dependencies" or "devDependencies":
// "some-unused-package": "^1.2.3"
```

Use your editor or `jq` to edit cleanly. Do NOT use `pnpm remove` without checking workspace root first — some packages are hoisted.

- [ ] **Step 5: Update lockfile**

```bash
pnpm install
```

Expected: lockfile updated, no install errors.

- [ ] **Step 6: Build all packages**

```bash
pnpm build
```

Expected: all packages build successfully. If any fail with "Cannot find module X" — the removed package was actually needed. Add it back.

- [ ] **Step 7: Run tests**

```bash
pnpm test:run
```

Expected: all tests pass.

- [ ] **Step 8: Typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: remove unused npm dependencies (depcheck)"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 2: Run all tests**

```bash
pnpm test:run
```

Expected: all pass.

- [ ] **Step 3: Build everything**

```bash
pnpm build
```

Expected: exits 0.

- [ ] **Step 4: Run knip one final time**

```bash
pnpm knip --reporter compact
```

Expected: zero genuine unused code flagged.

- [ ] **Step 5: Summary commit**

```bash
git log --oneline chore/full-cleanup ^feat/memory-graph-3d-rotation
```

Review all commits on the cleanup branch. Then push:

```bash
git push -u origin chore/full-cleanup
```

---

## Notes

- **Do not delete** anything in `doc/`, `docs/`, `evals/`, `releases/` (directory itself), `.agents/`, `skills/`
- **Knip false positives** common in monorepos: dynamic imports, config-discovered plugins, re-exports for public API surface. Always add to `knip.config.ts` ignore rather than deleting.
- **depcheck false positives** common with: peer deps, PostCSS/Tailwind plugins, TypeScript path aliases, `tsx` runtime loader
- If `pnpm build` fails after depcheck removals, restore the removed package immediately with `git checkout package.json` for that package
