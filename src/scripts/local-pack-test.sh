#!/usr/bin/env bash
# End-to-end smoke test of the *published* package: pack the repo with `pnpm
# local-pack`, install that tarball into a throwaway SvelteKit app (like a
# real consumer would), run it in dev mode, then build it and run it in
# production mode. Catches packaging bugs the in-repo Playwright suite can't
# see (exports/files, native deps, the app/package.json relative-path fixup).
#
# Also verifies a third-party plugin and field mount correctly (see
# tests/consumer/lib/+rime/rime.config.server.ts, which hard-imports both) — in both the npm
# and pnpm passes, since the polymorphic $rime/<name> resolution they exercise doesn't care
# which package manager installed them. The plugin+field config is copied into place *before*
# `rime init` runs, so `rime init`'s own generate() does the schema-gen + drizzle-migrate work
# as part of a normal cold init — no live dev-server hot-reload involved. (Swapping the config
# into an *already-running* dev server to exercise the file-watcher's live regen path is a
# separate, currently-flaky-under-drizzle-<1.0 concern — deferred, not covered here.)
#
# Usage: bash src/scripts/local-pack-test.sh --plugin-package <spec> --field-package <spec>
#          [--keep] [--skip-pack] [--base-dir <path>]
#   --plugin-package <spec>, --field-package <spec>
#                     required, no default — passed straight through to `npm install <spec>`
#                     / `pnpm add <spec>`, so anything either accepts works: a local tarball
#                     path (built via `npm run local-pack` in the package's own repo) or a
#                     real registry package spec (name, optionally @version). No hardcoded
#                     path to either package anywhere in this script.
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
# Must match the db name hardcoded in tests/consumer/lib/+rime/rime.config.server.ts's
# `adapterSqlite('consumer.sqlite')` — this name is passed to `rime init -n`, which is what
# generates drizzle.config.ts's `dbCredentials.url`. The fixture overwrites rime.config.server.ts
# after init but drizzle.config.ts is never regenerated, so a mismatch here means drizzle-kit
# and the running app silently target two different sqlite files.
APP_NAME="consumer"
BASE_DIR="$HOME"
KEEP_ON_SUCCESS=0
SKIP_PACK=0
PLUGIN_PACKAGE=""
FIELD_PACKAGE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP_ON_SUCCESS=1; shift ;;
    --skip-pack) SKIP_PACK=1; shift ;;
    --base-dir) BASE_DIR="$2"; shift 2 ;;
    --plugin-package) PLUGIN_PACKAGE="$2"; shift 2 ;;
    --field-package) FIELD_PACKAGE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

[[ -n "$PLUGIN_PACKAGE" ]] || { echo "--plugin-package is required (a tarball path or npm package spec)"; exit 1; }
[[ -n "$FIELD_PACKAGE" ]] || { echo "--field-package is required (a tarball path or npm package spec)"; exit 1; }
command -v sqlite3 >/dev/null || { echo "sqlite3 is required (used to verify the plugin's migration actually ran)"; exit 1; }

WORK_DIR="$BASE_DIR/$APP_NAME"
ADMIN_EMAIL="${TESTS_ADMIN_EMAIL:-admin@email.com}"
ADMIN_PASSWORD="${TESTS_ADMIN_PASSWORD:-a&1Aa&1A}"

TARBALL=""

log() {
  echo "——————————————————————————————————————————";
  echo " ⚡︎ $*";
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
  # Both suites by default: consumer.test.ts (base app) and consumer-plugin.test.ts (plugin +
  # field, now baked into the config from before `rime init` runs - see verify_plugin_mounted).
  local test_match=${6:-'consumer(-plugin)?\.test\.ts$'}
  log "Running UI tests against $url ($test_match)"
  (
    cd "$ROOT_DIR"
    PUBLIC_RIME_URL="$url" \
    TESTS_ADMIN_EMAIL="$ADMIN_EMAIL" \
    TESTS_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    CONSUMER_TEST_SUFFIX="$suffix" \
    CONSUMER_SERVER_COMMAND="$server_command" \
    CONSUMER_SERVER_CWD="$server_cwd" \
    CONSUMER_SERVER_PORT="$port" \
    CONSUMER_TEST_MATCH="$test_match" \
      pnpm exec playwright test -c tests/consumer/playwright.config.consumer.ts
  )
}

# Copies tests/consumer/lib/+rime/rime.config.server.ts (which hard-imports the plugin/field
# packages) into the freshly-scaffolded $WORK_DIR *before* `rime init` runs there - `rime
# init`'s own setConfig() only writes its placeholder when no config exists yet, so this one
# wins, and init's generate({force:true}) does the full cold-start pipeline against it: AST
# sanitize -> schema regen -> drizzle-kit generate -> drizzle-kit migrate. Call this right
# after `rime init` returns.
copy_plugin_config() {
  mkdir -p "$WORK_DIR/src/lib/+rime"
  cp -rf "$ROOT_DIR/tests/consumer/lib/+rime/"* "$WORK_DIR/src/lib/+rime/"
}

# Static, no-server check that the plugin+field config `rime init` just processed actually
# mounted: the generated schema includes the plugin's table, and drizzle-kit's migration
# created it for real in the sqlite db. `rime init` runs generate() synchronously and returns
# only once it's done, so nothing here is racing a background process - a live dev-server
# hot-reload version of this (config swapped into an *already-running* server) is a separate,
# currently-flaky-under-drizzle-<1.0 concern, deferred rather than covered here.
verify_plugin_mounted() {
  (
    cd "$WORK_DIR"

    # tests/consumer's fixture is folder-mode, so the schema always lands here (see
    # adapter-sqlite/generate-schema/write.server.ts's isFolderConfig() branch) - not just
    # that generation ran, but that it produced the right thing.
    SCHEMA_FILE="src/lib/+rime.generated/schema.server.ts"
    grep -q "pluginVisits" "$SCHEMA_FILE" || {
      echo "generated schema is missing the plugin's pluginVisits table"
      cat "$SCHEMA_FILE"
      exit 1
    }

    # The one check that actually proves the whole pipeline worked end to end, not just that
    # a schema file exists on disk: query the real database for the real table drizzle-kit's
    # migration was supposed to create.
    TABLE=$(sqlite3 db/consumer.sqlite "SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_visits';" 2>/dev/null || true)
    [[ -n "$TABLE" ]] || { echo "plugin_visits table missing from db/consumer.sqlite after rime init"; exit 1; }
  )
}

# Packing rime

if [[ $SKIP_PACK -eq 1 ]]; then
  log "[1/15] --skip-pack: reusing newest rimecms-*.tgz"
  TARBALL=$(ls -t "$ROOT_DIR"/rimecms-*.tgz 2>/dev/null | head -1 || true)
  [[ -f "$TARBALL" ]] || { echo "--skip-pack: no rimecms-*.tgz found at $ROOT_DIR - run once without --skip-pack first"; exit 1; }
  echo "    reusing $TARBALL"
else
  log "[1/15] Packing local package (pnpm local-pack)"
  PACK_OUTPUT=$(pnpm local-pack)
  TARBALL=$(echo "$PACK_OUTPUT" | tail -1 | sed -E 's/^Package created at: //')
  [[ -f "$TARBALL" ]] || { echo "Could not resolve tarball path from local-pack output:"; echo "$PACK_OUTPUT"; exit 1; }
  log "  packed at $TARBALL"
fi

# NPM

## Create svelte app
log "[2/15] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
npx sv create --template minimal --types ts --add eslint --install npm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[3/15] Installing packed rimecms, plugin and field"
npm install "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[4/15] Copying plugin+field config, running rime init"
copy_plugin_config
npx rime init -n "$APP_NAME"

log "[5/15] Verifying plugin + field mounted (npm)"
verify_plugin_mounted

## UI test (dev)
log "[6/15] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[7/15] Building for production"
cd "$WORK_DIR"
npx rime build -d -e -s -s
cd app

# Add ../ to every local-package (file:) dependency, not just rimecms — the app just moved
# down one directory into ./app, so any file: path needs one more ../ to still resolve.
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
for (const key of ['dependencies', 'devDependencies']) {
  for (const name of Object.keys(pkg[key] || {})) {
    const dep = pkg[key][name];
    if (dep && dep.startsWith('file:')) {
      pkg[key][name] = 'file:../' + dep.slice('file:'.length);
      console.log('  ' + name + ': ' + dep + ' -> ' + pkg[key][name]);
    }
  }
}
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Install deps
npm install serve-static sharp

# UI test (prod)
log "[8/15] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

# PNPM

## Create svelte app
log "[9/15] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
pnpm dlx sv create --template minimal --types ts --add eslint --install pnpm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[10/15] Installing packed rimecms, plugin and field"
pnpm add "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[11/15] Copying plugin+field config, running rime init"
copy_plugin_config
pnpm exec rime init -n "$APP_NAME"

log "[12/15] Verifying plugin + field mounted (pnpm)"
verify_plugin_mounted

## UI tests (dev)
log "[13/15] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[14/15] Building for production"
cd "$WORK_DIR"
pnpm exec rime build -d -e -s
cd app

## Install deps
pnpm add serve-static sharp

## UI test (prod)
log "[15/15] UI test pass 2 (production, :3000)"
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
