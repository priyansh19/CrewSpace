#!/usr/bin/env bash
# prepare-server-ui-dist.sh — Copy the built renderer into server/ui-dist.
#
# Called by `pnpm --filter @crewspaceai/server prepack` before publishing the
# server package so the UI is bundled alongside the API.
#
# Prerequisites:
#   Run `pnpm --filter crewspace-desktop build:renderer` (or `pnpm build`)
#   to produce desktop-electron/renderer-dist before running this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RENDERER_DIST="$REPO_ROOT/desktop-electron/renderer-dist"
SERVER_UI_DIST="$REPO_ROOT/server/ui-dist"

if [ ! -d "$RENDERER_DIST" ]; then
  echo "[prepare-server-ui-dist] ERROR: renderer-dist not found at $RENDERER_DIST" >&2
  echo "[prepare-server-ui-dist] Run 'pnpm --filter crewspace-desktop build:renderer' first." >&2
  exit 1
fi

if [ ! -f "$RENDERER_DIST/index.html" ]; then
  echo "[prepare-server-ui-dist] ERROR: renderer-dist exists but index.html is missing." >&2
  exit 1
fi

echo "[prepare-server-ui-dist] Copying renderer-dist -> server/ui-dist..."
rm -rf "$SERVER_UI_DIST"
cp -r "$RENDERER_DIST" "$SERVER_UI_DIST"
echo "[prepare-server-ui-dist] Done ($(du -sh "$SERVER_UI_DIST" | cut -f1) total)."
