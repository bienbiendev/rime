#!/usr/bin/env bash
# Smoke tests the published package: packs this repo, installs the tarball into a throwaway
# SvelteKit app, runs it in dev then prod. Also verifies a plugin and field package mount,
# across npm, pnpm, and bun passes, plus a 4th npm-only/dev-only pass proving RIME_PANEL_ROUTE
# and RIME_CONFIG_DIR both take when set as shell-prefixed env vars on `rime init` itself.
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

# Always test the CLI's actual default. Without this, this repo's own .env (RIME_CONFIG_DIR=
# src/lib/+rime, picked up by an autoenv-style shell plugin on cd into this repo) leaks into
# every child process spawned below, including the scaffolded test apps' own `rime init`.
unset RIME_CONFIG_DIR
unset RIME_PANEL_ROUTE

WORK_DIR="$BASE_DIR/$APP_NAME"
ADMIN_EMAIL="${TESTS_ADMIN_EMAIL:-admin@email.com}"
ADMIN_PASSWORD="${TESTS_ADMIN_PASSWORD:-a&1Aa&1A}"

# Values for the 4th pass, proving RIME_PANEL_ROUTE + RIME_CONFIG_DIR both take
# via a shell-prefixed `rime init` invocation (see bottom of this script).
CUSTOM_PANEL_ROUTE="backoffice"
CUSTOM_CONFIG_DIR="src/custom-rime"

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
      pnpm add "$TARBALL" >&2
      # local-pack only builds — it never runs `rime generate`, so without this src/routes,
      # +rime.generated, hooks.server.ts, and drizzle.config.ts stay whatever they were the
      # last time *anyone* generated them, possibly with an older rime, not the tarball just
      # installed above.
      pnpm exec rime generate >&2
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
  # Only set for the 4th (custom-route) pass — tests/util.ts's PANEL_SEGMENT falls back to
  # 'panel' when this is empty, matching the other 3 passes' default configuration.
  local panel_route=${7:-}
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
    RIME_PANEL_ROUTE="$panel_route" \
      bunx playwright test -c tests/consumer/playwright.config.consumer.ts
  )
}

# Copies the plugin+field config into place before `rime init` runs, so init's own generate()
# picks it up. Target dir defaults to the CLI's own default (src/+rime) — pass a different one
# for a pass that also customizes RIME_CONFIG_DIR, or init's setConfig() won't find this file
# and will silently scaffold a fresh, plugin-less default config at the custom path instead.
copy_plugin_config() {
  local config_dir=${1:-src/+rime}
  mkdir -p "$WORK_DIR/$config_dir"
  cp -rf "$ROOT_DIR/tests/consumer/+rime/"* "$WORK_DIR/$config_dir/"
}

# Verifies the plugin+field config actually mounted: schema + db table. Config dir defaults to
# the CLI's own default (src/+rime) — pass a different one to match a pass that also customizes
# RIME_CONFIG_DIR, and to confirm generation landed there (not at the stale default location).
verify_plugin_mounted() {
  local config_dir=${1:-src/+rime}
  (
    cd "$WORK_DIR"

    # Schema always lands here.
    SCHEMA_FILE="$config_dir.generated/schema.server.ts"
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
  log "[1/27] --skip-pack: reusing newest rimecms-*.tgz"
  TARBALL=$(ls -t "$ROOT_DIR"/rimecms-*.tgz 2>/dev/null | head -1 || true)
  [[ -f "$TARBALL" ]] || { echo "--skip-pack: no rimecms-*.tgz found at $ROOT_DIR - run once without --skip-pack first"; exit 1; }
  echo "    reusing $TARBALL"
else
  log "[1/27] Packing local package (bun run local-pack)"
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
log "[2/27] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
npx sv create --template minimal --types ts --add eslint --install npm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[3/27] Installing packed rimecms, plugin and field"
npm install "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[4/27] Copying plugin+field config, running rime init"
copy_plugin_config
npx rime init -n "$APP_NAME"

log "[5/27] Verifying plugin + field mounted (npm)"
verify_plugin_mounted

## UI test (dev)
log "[6/27] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[7/27] Building for production"
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

# envProduction() must carry RIME_PANEL_ROUTE through, or _live preview URLs silently fall
# back to the default 'panel' segment in production under a customized route.
grep -q '^RIME_PANEL_ROUTE=' .env || { echo "app/.env is missing RIME_PANEL_ROUTE"; exit 1; }

# UI test (prod)
log "[8/27] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

# PNPM

## Create svelte app
log "[9/27] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
pnpm dlx sv create --template minimal --types ts --add eslint --install pnpm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[10/27] Installing packed rimecms, plugin and field"
pnpm add "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[11/27] Copying plugin+field config, running rime init"
copy_plugin_config
pnpm exec rime init -n "$APP_NAME"

log "[12/27] Verifying plugin + field mounted (pnpm)"
verify_plugin_mounted

## UI tests (dev)
log "[13/27] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[14/27] Building for production"
cd "$WORK_DIR"
pnpm exec rime build -d -e -s
cd app

## Install deps
pnpm add serve-static sharp

## UI test (prod)
log "[15/27] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

# BUN

## Create svelte app
log "[16/27] Scaffolding fresh SvelteKit app"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
bunx sv create --template minimal --types ts --add eslint --install bun "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[17/27] Installing packed rimecms, plugin and field"
bun add "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config in before init, so init's own generate() mounts them cold
log "[18/27] Copying plugin+field config, running rime init"
copy_plugin_config
bunx rime init -n "$APP_NAME"

log "[19/27] Verifying plugin + field mounted (bun)"
verify_plugin_mounted

## UI tests (dev)
log "[20/27] UI test pass 1 (dev, :5173)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "dev"

## Build
log "[21/27] Building for production"
cd "$WORK_DIR"
bunx rime build -d -e -s
cd app

## Install deps
bun add serve-static sharp

## UI test (prod)
log "[22/27] UI test pass 2 (production, :3000)"
run_ui_tests \
  "http://localhost:3000" \
  "PORT=3000 HOST=localhost ORIGIN=http://localhost:3000 node --env-file=.env index.js 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
  "$WORK_DIR/app" \
  3000 \
  "prod"

# CUSTOM ROUTE + CONFIG DIR (npm, dev only)
# Proves RIME_PANEL_ROUTE and RIME_CONFIG_DIR both take when set as a shell-prefixed env var
# on `rime init` itself (they're read once at process start, and only override the .env file
# on a project's *first* init — setEnv() is add-only, so this only works against a project
# with no existing .env, which is exactly what a fresh scaffold is). Dev-only and no separate
# prod build: a route/config-dir change requires a fresh rime init/generate before it's picked
# up by any build anyway, and that's already what this pass does; re-verifying the npm/pnpm/bun
# split or a second production build here would just re-test what passes 1-3 already cover.

## Create svelte app
log "[23/27] Scaffolding fresh SvelteKit app (custom panel route + config dir)"
cd "$BASE_DIR"
rm -rf "$APP_NAME"
npx sv create --template minimal --types ts --add eslint --install npm "$APP_NAME"
cd "$APP_NAME"

## Install rimecms + plugin + field
log "[24/27] Installing packed rimecms, plugin and field"
npm install "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

## Copy plugin+field config into the *custom* config dir before init, so init's own generate()
## mounts them cold at the right location.
log "[25/27] Copying plugin+field config, running rime init with RIME_PANEL_ROUTE + RIME_CONFIG_DIR"
copy_plugin_config "$CUSTOM_CONFIG_DIR"
RIME_PANEL_ROUTE="$CUSTOM_PANEL_ROUTE" RIME_CONFIG_DIR="$CUSTOM_CONFIG_DIR" npx rime init -n "$APP_NAME"

# Confirms the custom .env values actually stuck and generation landed under the custom dir,
# not silently at the CLI's default (src/+rime) — the failure mode if copy_plugin_config or
# setConfig() ever regress to ignoring RIME_CONFIG_DIR.
grep -q "^RIME_PANEL_ROUTE=$CUSTOM_PANEL_ROUTE$" .env || { echo ".env's RIME_PANEL_ROUTE wasn't set to $CUSTOM_PANEL_ROUTE"; exit 1; }
grep -q "^RIME_CONFIG_DIR=$CUSTOM_CONFIG_DIR$" .env || { echo ".env's RIME_CONFIG_DIR wasn't set to $CUSTOM_CONFIG_DIR"; exit 1; }
[[ -d "$CUSTOM_CONFIG_DIR.generated" ]] || { echo "$CUSTOM_CONFIG_DIR.generated is missing - config didn't generate at the custom dir"; exit 1; }
[[ -d "src/+rime.generated" ]] && { echo "src/+rime.generated exists - generation fell back to the default dir instead of $CUSTOM_CONFIG_DIR"; exit 1; }

log "[26/27] Verifying plugin + field mounted at the custom config dir"
verify_plugin_mounted "$CUSTOM_CONFIG_DIR"

## UI test (dev) — consumer.test.ts reused as-is (its panelUrl()/panelUrlRe() helpers read
## RIME_PANEL_ROUTE from tests/util.ts), plus the dedicated custom-route assertions.
log "[27/27] UI test pass (dev, :5173, custom panel route)"
run_ui_tests \
  "http://localhost:5173" \
  "./node_modules/.bin/vite dev --port 5173 2>&1 | tee \"$WORK_DIR/dev.log\"" \
  "$WORK_DIR" \
  5173 \
  "custom-route" \
  'consumer\.test\.ts$|consumer-custom-panel-route\.test\.ts$' \
  "$CUSTOM_PANEL_ROUTE"

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
