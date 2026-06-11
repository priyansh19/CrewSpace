#!/usr/bin/env bash
# Builds the UI package and copies the output into server/ui-dist/
# Called by server's "prepack" script so the server bundle includes the UI.
set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI_DIST="$REPO_ROOT/ui/dist"
SERVER_UI_DIST="$REPO_ROOT/server/ui-dist"

echo "Building UI..."
cd "$REPO_ROOT"
pnpm --filter @crewspaceai/ui build

echo "Copying $UI_DIST → $SERVER_UI_DIST"
rm -rf "$SERVER_UI_DIST"
cp -r "$UI_DIST" "$SERVER_UI_DIST"
echo "Done."
