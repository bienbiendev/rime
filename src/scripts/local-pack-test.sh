#!/usr/bin/env bash
# End-to-end smoke test of the *published* package: pack the repo with `pnpm
# local-pack`, install that tarball into a throwaway SvelteKit app (like a
# real consumer would), run it in dev mode, then build it and run it in
# production mode. Catches packaging bugs the in-repo Playwright suite can't
# see (exports/files, native deps, the app/package.json relative-path fixup).
#
# Usage: bash src/scripts/local-pack-test.sh [--keep] [--skip-pack] [--base-dir <path>]
#   --keep            don't delete the scaffolded app on success (useful for debugging)
#   --skip-pack       reuse the newest rimecms-*.tgz already at repo root instead of
#                     re-running `pnpm local-pack` (also skips the on-success tarball
#                     delete, so it stays around for the next --skip-pack run)
#   --base-dir <path> where to scaffold the app, defaults to $HOME. NOT $ROOT_DIR: pnpm
#                     resolves `pnpm config set --location=project` (see
#                     configurePnpm() in package-manager.server.ts) by walking up to the
#                     nearest git boundary, not by cwd - nested inside rime's own repo,
#                     that walk-up lands on rime's own root and corrupts its
#                     pnpm-workspace.yaml instead of the scaffolded app's own (confirmed,
#                     not theoretical - this is exactly what forced this default).
#                     Only pass --base-dir "$ROOT_DIR" if you know what you're doing.
set -euo pipefail

ROOT_DIR="$(pwd)"
APP_NAME="consumer-app-test"
BASE_DIR="$HOME"
KEEP_ON_SUCCESS=0
SKIP_PACK=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP_ON_SUCCESS=1; shift ;;
    --skip-pack) SKIP_PACK=1; shift ;;
    --base-dir) BASE_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

WORK_DIR="$BASE_DIR/$APP_NAME"
ADMIN_EMAIL="${TESTS_ADMIN_EMAIL:-admin@email.com}"
ADMIN_PASSWORD="${TESTS_ADMIN_PASSWORD:-a&1Aa&1A}"

TARBALL=""

log() { 
  echo "";
  echo "";
  echo "-> $*";
  echo "";
}

cleanup() {
  local status=$?
  if [[ $status -ne 0 ]]; then
    echo ""
    echo "[x] consumer test failed (exit $status) - workspace kept at $WORK_DIR"
    [[ -f "$WORK_DIR/dev.log" ]] && { echo "--- last 40 lines of dev.log ---"; tail -40 "$WORK_DIR/dev.log"; }
    [[ -f "$WORK_DIR/app/prod.log" ]] && { echo "--- last 40 lines of app/prod.log ---"; tail -40 "$WORK_DIR/app/prod.log"; }
  fi
  exit $status
}
trap cleanup EXIT

run_ui_tests() {
  local url=$1
  local server_command=$2
  local server_cwd=$3
  local port=$4
  local suffix=$5
  log "Running UI tests against $url"
  (
    cd "$ROOT_DIR"
    PUBLIC_RIME_URL="$url" \
    TESTS_ADMIN_EMAIL="$ADMIN_EMAIL" \
    TESTS_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    CONSUMER_TEST_SUFFIX="$suffix" \
    CONSUMER_SERVER_COMMAND="$server_command" \
    CONSUMER_SERVER_CWD="$server_cwd" \
    CONSUMER_SERVER_PORT="$port" \
      pnpm exec playwright test -c tests/consumer/playwright.config.consumer.ts
  )
}

# Packing rime

if [[ $SKIP_PACK -eq 1 ]]; then
  log "[1/13] --skip-pack: reusing newest rimecms-*.tgz"
  TARBALL=$(ls -t "$ROOT_DIR"/rimecms-*.tgz 2>/dev/null | head -1 || true)
  [[ -f "$TARBALL" ]] || { echo "--skip-pack: no rimecms-*.tgz found at $ROOT_DIR - run once without --skip-pack first"; exit 1; }
  echo "-> reusing $TARBALL"
else
  log "[1/13] Packing local package (pnpm local-pack)"
  PACK_OUTPUT=$(pnpm local-pack)
  TARBALL=$(echo "$PACK_OUTPUT" | tail -1 | sed -E 's/^Package created at: //')
  [[ -f "$TARBALL" ]] || { echo "Could not resolve tarball path from local-pack output:"; echo "$PACK_OUTPUT"; exit 1; }
  log "  packed at $TARBALL"
fi

# NPM 

## Create svelte app
log "[2/13] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
npx sv create --template minimal --types ts --add eslint --install npm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms
log "[3/13] Installing packed rimecms"
npm install "$TARBALL"

## Init rimecms
log "[4/13] Running rime init"
npx rime init -n "$APP_NAME"

## UI test (dev)
log "[5/13] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[6/13] Building for production"
cd "$WORK_DIR"
npx rime build -d -e -s -s
cd app

# Add ../ to local-package as npm resolve it relatively
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
for (const key of ['dependencies', 'devDependencies']) {
  const dep = pkg[key] && pkg[key].rimecms;
  if (dep && dep.startsWith('file:')) {
    pkg[key].rimecms = 'file:../' + dep.slice('file:'.length);
    console.log('');
    console.log('-> rimecms: ' + dep + ' -> ' + pkg[key].rimecms);
  }
}
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Install deps
npm install serve-static sharp

# UI test (prod)
log "[7/13] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

# PNPM

## Create svelte app
log "[8/13] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
pnpm dlx sv create --template minimal --types ts --add eslint --install pnpm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms
log "[9/13] Installing packed rimecms"
pnpm add "$TARBALL"

## Init rimecms
log "[10/13] Running rime init"
pnpm exec rime init -n "$APP_NAME"

## UI tests (dev)
log "[11/13] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build 
log "[12/13] Building for production"
cd "$WORK_DIR"
pnpm exec rime build -d -e -s
cd app

## Install deps
pnpm add serve-static sharp

## UI test (prod)
log "[13/13] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

echo ""

# Clean up
if [[ $KEEP_ON_SUCCESS -eq 1 ]]; then
  echo "[✓] consumer test passed - workspace kept at $WORK_DIR (--keep)"
else
  rm -rf "$WORK_DIR"
  [[ -n "$TARBALL" && $SKIP_PACK -eq 0 ]] && rm -f "$TARBALL"
  echo "[✓] consumer test passed, workspace cleaned"
fi

log "All good."
