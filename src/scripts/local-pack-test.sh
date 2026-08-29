#!/usr/bin/env bash
# Smoke tests the published package: packs this repo, installs the tarball into a throwaway
# SvelteKit app, runs it in dev then prod. Also verifies a plugin and field package mount,
# across npm, pnpm, and bun passes.
#
# Usage: bash src/scripts/local-pack-test.sh --plugin-package <path> --field-package <path>
#          [--keep] [--skip-pack] [--base-dir <path>]
#
#   --plugin-package <path>, --field-package <path>
#       local tarball path for consumer-<plugin|field>, or a directory to rebuild from source
#   --keep       Keep the scaffolded app after a successful run, for debugging.
#   --skip-pack  Reuse the newest rimecms-*.tgz
#   --base-dir <path>  Where to scaffold the consumer app. Defaults to $HOME.
set -euo pipefail

ROOT_DIR="$(pwd)"
# Must match tests/consumer/lib/+rime/rime.config.server.ts's adapterSqlite('consumer.sqlite')
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

# Rebuilds a directory package from source against the packed rime tarball (pnpm add + pnpm
# local-pack); a tarball path or registry spec passes through unchanged.
resolve_package_spec() {
  local spec=$1
  if [[ -d "$spec" ]]; then
    (
      cd "$spec"
      echo "  rebuilding $spec from source" >&2
      pnpm add "$TARBALL" >&2
      local pack_output
      pack_output=$(pnpm local-pack)
      local tarball
      tarball=$(echo "$pack_output" | tail -1 | sed -E 's/^Package created at: //')
      [[ -f "$tarball" ]] || {
        echo "Could not resolve tarball path from $spec's local-pack output:" >&2
        echo "$pack_output" >&2
        exit 1
      }
      echo "$tarball"
    )
  else
    echo "$spec"
  fi
}

run_ui_tests() {
  local url=$1
  local server_command=$2
  local server_cwd=$3
  local port=$4
  local suffix=$5
  # consumer.test.ts + consumer-plugin.test.ts by default
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
      bunx playwright test -c tests/consumer/playwright.config.consumer.ts
  )
}

# Copies the plugin+field config into place before `rime init` runs, so init's own generate()
# picks it up.
copy_plugin_config() {
  mkdir -p "$WORK_DIR/src/lib/+rime"
  cp -rf "$ROOT_DIR/tests/consumer/lib/+rime/"* "$WORK_DIR/src/lib/+rime/"
}

# Verifies the plugin+field config actually mounted: schema + db table.
verify_plugin_mounted() {
  (
    cd "$WORK_DIR"

    # Schema always lands here.
    SCHEMA_FILE="src/lib/+rime.generated/schema.server.ts"
    grep -q "pluginVisits" "$SCHEMA_FILE" || {
      echo "generated schema is missing the plugin's pluginVisits table"
      cat "$SCHEMA_FILE"
      exit 1
    }

    # Confirms drizzle-kit's migration actually created the table.
    TABLE=$(sqlite3 db/consumer.sqlite "SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_visits';" 2>/dev/null || true)
    [[ -n "$TABLE" ]] || { echo "plugin_visits table missing from db/consumer.sqlite after rime init"; exit 1; }
  )
}

# Packing rime

if [[ $SKIP_PACK -eq 1 ]]; then
  log "[1/23] --skip-pack: reusing newest rimecms-*.tgz"
  TARBALL=$(ls -t "$ROOT_DIR"/rimecms-*.tgz 2>/dev/null | head -1 || true)
  [[ -f "$TARBALL" ]] || { echo "--skip-pack: no rimecms-*.tgz found at $ROOT_DIR - run once without --skip-pack first"; exit 1; }
  echo "    reusing $TARBALL"
else
  log "[1/23] Packing local package (bun run local-pack)"
  PACK_OUTPUT=$(bun run local-pack)
  TARBALL=$(echo "$PACK_OUTPUT" | tail -1 | sed -E 's/^Package created at: //')
  [[ -f "$TARBALL" ]] || { echo "Could not resolve tarball path from local-pack output:"; echo "$PACK_OUTPUT"; exit 1; }
  log "  packed at $TARBALL"
fi

log "Resolving plugin/field packages"
PLUGIN_PACKAGE=$(resolve_package_spec "$PLUGIN_PACKAGE")
FIELD_PACKAGE=$(resolve_package_spec "$FIELD_PACKAGE")
echo "  plugin: $PLUGIN_PACKAGE"
echo "  field:  $FIELD_PACKAGE"

# NPM

## Create svelte app
log "[2/23] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
npx sv create --template minimal --types ts --add eslint --install npm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[3/23] Installing packed rimecms, plugin and field"
npm install "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[4/23] Copying plugin+field config, running rime init"
copy_plugin_config
npx rime init -n "$APP_NAME"

log "[5/23] Verifying plugin + field mounted (npm)"
verify_plugin_mounted

## UI test (dev)
log "[6/23] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[7/23] Building for production"
cd "$WORK_DIR"
npx rime build -d -e -s -s
cd app

# Adjust file: deps for the extra ./app nesting
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
log "[8/23] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

# PNPM

## Create svelte app
log "[9/23] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
pnpm dlx sv create --template minimal --types ts --add eslint --install pnpm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[10/23] Installing packed rimecms, plugin and field"
pnpm add "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[11/23] Copying plugin+field config, running rime init"
copy_plugin_config
pnpm exec rime init -n "$APP_NAME"

log "[12/23] Verifying plugin + field mounted (pnpm)"
verify_plugin_mounted

## UI tests (dev)
log "[13/23] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[14/23] Building for production"
cd "$WORK_DIR"
pnpm exec rime build -d -e -s
cd app

## Install deps
pnpm add serve-static sharp

## UI test (prod)
log "[15/23] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

# BUN

## Create svelte app
log "[16/23] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
bunx sv create --template minimal --types ts --add eslint --install bun "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[17/23] Installing packed rimecms, plugin and field"
bun add "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[18/23] Copying plugin+field config, running rime init"
copy_plugin_config
bunx rime init -n "$APP_NAME"

log "[19/23] Verifying plugin + field mounted (bun)"
verify_plugin_mounted

## UI tests (dev)
log "[20/23] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[21/23] Building for production"
cd "$WORK_DIR"
bunx rime build -d -e -s
cd app

## Install deps
bun add serve-static sharp

## UI test (prod)
log "[22/23] UI test pass 2 (production, :3000)"
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
