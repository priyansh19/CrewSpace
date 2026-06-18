#!/usr/bin/env bash
# provision-worktree.sh — Set up a fresh CrewSpace git worktree.
#
# This script is run once inside a newly created worktree before an agent
# starts working.  It installs dependencies and performs any one-time setup
# required so the worktree is ready to use.
#
# Usage (set as provisionCommand in workspace strategy):
#   bash ./scripts/provision-worktree.sh

set -euo pipefail

echo "[provision-worktree] Provisioning worktree at: $(pwd)"

# Install workspace dependencies only when a package manifest is present.
if [ -f "package.json" ] && command -v pnpm &>/dev/null; then
  echo "[provision-worktree] Installing dependencies with pnpm..."
  pnpm install --frozen-lockfile --ignore-scripts 2>/dev/null \
    || pnpm install --ignore-scripts
elif [ -f "package.json" ] && command -v npm &>/dev/null; then
  echo "[provision-worktree] Installing dependencies with npm..."
  npm install --ignore-scripts
else
  echo "[provision-worktree] No package.json found; skipping dependency install."
fi

echo "[provision-worktree] Done."
