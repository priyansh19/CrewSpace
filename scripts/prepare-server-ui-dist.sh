#!/usr/bin/env bash
set -euo pipefail

# prepare-server-ui-dist.sh — Build the desktop renderer and copy it into server/ui-dist.
# This keeps @crewspaceai/server publish artifacts self-contained for static UI serving.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RENDERER_DIST="$REPO_ROOT/desktop-electron/renderer-dist"
SERVER_UI_DIST="$REPO_ROOT/server/ui-dist"

echo "  -> Building desktop renderer..."
pnpm --dir "$REPO_ROOT/desktop-electron" run build:renderer

if [ ! -f "$RENDERER_DIST/index.html" ]; then
  echo "Error: Renderer build output missing at $RENDERER_DIST/index.html"
  exit 1
fi

rm -rf "$SERVER_UI_DIST"
cp -r "$RENDERER_DIST" "$SERVER_UI_DIST"
echo "  -> Copied desktop-electron/renderer-dist to server/ui-dist"
