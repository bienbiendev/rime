#!/usr/bin/env bash
# Smoke tests the published package: packs this repo, installs the tarball into throwaway
# SvelteKit apps, runs each in dev then prod. Also verifies a plugin and field package mount.
#
# Passes, each a fresh app:
#   npm           npm, Node
#   pnpm          pnpm, Node
#   bun           the Bun pack: bun install, `rime init --bun` (bun:sqlite, vite on Bun),
#                 `rime build`, the built server on Bun
#   custom-route  npm, Node, dev only: RIME_PANEL_ROUTE and RIME_CONFIG_DIR set as
#                 shell-prefixed env vars on `rime init` itself both take
#
# Each pass has its own app, ports and log, so up to --jobs of them run at once:
#
#   ~/consumer/consumer-npm           :5181 dev  :3101 prod  ~/consumer/npm.log
#   ~/consumer/consumer-pnpm          :5182      :3102       ~/consumer/pnpm.log
#   ~/consumer/consumer-bun           :5183      :3103       ~/consumer/bun.log
#   ~/consumer/consumer-custom-route  :5184                  ~/consumer/custom-route.log
#
# Away from 5173 and 3000, so a dev server already running elsewhere does not take a pass's port.
#
# Usage: bash src/scripts/local-pack-test.sh --plugin-package <path> --field-package <path>
#          [--only npm,pnpm,bun,custom-route] [--jobs <n>] [--keep] [--skip-pack]
#          [--skip-pack-libs] [--npm-force] [--base-dir <path>]
#
#   --plugin-package <path>, --field-package <path>
#       local tarball path for consumer-<plugin|field>, or a directory to rebuild from source
#   --only <passes>   Run only these passes, comma-separated (default: all four)
#   --jobs <n>        How many passes run at once (default: 2)
#   --keep            Keep the scaffolded apps after a successful run, for debugging.
#   --skip-pack       Reuse the newest rimecms-*.tgz instead of packing this repo
#   --skip-pack-libs  Reuse the newest *.tgz in the plugin and field directories instead of
#                     rebuilding them against the rime tarball
#   --npm-force       Every npm command runs with --force, `rime init`'s installs included: npm
#                     installs a peer range no published version satisfies anyway, and still
#                     installs the other peers.
#   --base-dir <path> Where to scaffold the consumer apps. Defaults to $HOME.
set -euo pipefail

ROOT_DIR="$(pwd)"
# Must match tests/consumer/lib/+rime/rime.config.server.ts's adapterSqlite('consumer.sqlite')
APP_NAME="consumer"
BASE_DIR="$HOME"
JOBS=2
KEEP_ON_SUCCESS=0
SKIP_PACK=0
SKIP_PACK_LIBS=0
ONLY="npm,pnpm,bun,custom-route"
PLUGIN_PACKAGE=""
FIELD_PACKAGE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep) KEEP_ON_SUCCESS=1; shift ;;
    --skip-pack) SKIP_PACK=1; shift ;;
    --skip-pack-libs) SKIP_PACK_LIBS=1; shift ;;
    # npm reads its config from npm_config_* variables, in this script and in every child it starts
    --npm-force) export npm_config_force=true; shift ;;
    --only) ONLY="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --base-dir) BASE_DIR="$2"; shift 2 ;;
    --plugin-package) PLUGIN_PACKAGE="$2"; shift 2 ;;
    --field-package) FIELD_PACKAGE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

[[ -n "$PLUGIN_PACKAGE" ]] || { echo "--plugin-package is required (a tarball path or npm package spec)"; exit 1; }
[[ -n "$FIELD_PACKAGE" ]] || { echo "--field-package is required (a tarball path or npm package spec)"; exit 1; }
command -v sqlite3 >/dev/null || { echo "sqlite3 is required (used to verify the plugin's migration actually ran)"; exit 1; }
for pass in ${ONLY//,/ }; do
  [[ "$pass" =~ ^(npm|pnpm|bun|custom-route)$ ]] || { echo "--only: unknown pass '$pass' (npm, pnpm, bun, custom-route)"; exit 1; }
done
[[ "$JOBS" =~ ^[1-9][0-9]*$ ]] || { echo "--jobs: expected a positive number, got '$JOBS'"; exit 1; }

# $RUN_DIR/consumer-npm   the npm pass's app, WORK_DIR while that pass runs
# $RUN_DIR/npm.log        everything the pass prints
# $RUN_DIR/npm.status     its exit code, once it ends
RUN_DIR="$BASE_DIR/$APP_NAME"
WORK_DIR=""
ADMIN_EMAIL="${TESTS_ADMIN_EMAIL:-admin@email.com}"
ADMIN_PASSWORD="${TESTS_ADMIN_PASSWORD:-a&1Aa&1A}"

# Values for the custom-route pass, proving RIME_PANEL_ROUTE + RIME_CONFIG_DIR both take
# via a shell-prefixed `rime init` invocation (see run_custom_route_pass).
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
    echo "[x] consumer test failed (exit $status)"
  fi
  exit $status
}
trap cleanup EXIT
# Passes in the background ignore Ctrl-C, so it stops them with a TERM to the whole group.
trap 'trap - INT TERM; kill 0' INT TERM

# Rebuilds a directory package from source against the packed rime tarball (pnpm add + pnpm
# local-pack); a tarball path or registry spec passes through unchanged. With --skip-pack-libs,
# a directory answers its newest tarball as it is.
resolve_package_spec() {
  local spec=$1
  if [[ -d "$spec" && $SKIP_PACK_LIBS -eq 1 ]]; then
    local tarball="" file
    while IFS= read -r -d '' file; do
      [[ -z "$tarball" || "$file" -nt "$tarball" ]] && tarball="$file"
    done < <(find "$spec" -maxdepth 2 -name '*.tgz' -not -path '*/node_modules/*' -print0)
    [[ -f "$tarball" ]] || { echo "--skip-pack-libs: no *.tgz in $spec - run once without it first" >&2; exit 1; }
    echo "$tarball"
  elif [[ -d "$spec" ]]; then
    (
      cd "$spec"
      # The file: spec is rewritten before installing: pnpm resolves every dependency first,
      # and the tarball of the previous rime version may be gone.
      node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
      for (const key of ['dependencies', 'devDependencies']) {
        if (pkg[key]?.rimecms?.startsWith('file:')) pkg[key].rimecms = 'file:$TARBALL';
      }
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
      " || exit 1
      pnpm install >&2 || exit 1
      # local-pack only builds. `rime init -f` brings the package up to the tarball just
      # installed: it adds what is missing (src/env.ts, rime's deps), keeps what exists, and
      # regenerates src/routes, src/params.ts, +rime.generated and hooks.server.ts.
      pnpm exec rime init -f >&2 || exit 1
      local pack_output
      pack_output=$(pnpm local-pack) || exit 1
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
  # Only set for the custom-route pass — tests/util.ts's PANEL_SEGMENT falls back to 'panel'
  # when this is empty, matching the other passes' default configuration.
  local panel_route=${7:-}
  log "Running UI tests against $url ($test_match)"
  # The server playwright starts inherits this environment, which wins over the app's .env
  (
    cd "$ROOT_DIR"
    # An empty one would still win, as an empty panel route
    if [[ -n $panel_route ]]; then
      export RIME_PANEL_ROUTE="$panel_route"
    fi
    # The cache plugin on, as an app would run it; the config's `$cache.isEnabled` picks the
    # requests it caches
    RIME_CACHE_ENABLED=true \
    SITE_URL="$url" \
    TESTS_ADMIN_EMAIL="$ADMIN_EMAIL" \
    TESTS_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    CONSUMER_TEST_SUFFIX="$suffix" \
    CONSUMER_SERVER_COMMAND="$server_command" \
    CONSUMER_SERVER_CWD="$server_cwd" \
    CONSUMER_SERVER_PORT="$port" \
    CONSUMER_TEST_MATCH="$test_match" \
      bunx playwright test -c tests/consumer/playwright.config.consumer.ts \
        --output "test-results/$(basename "$WORK_DIR")-$suffix"
  )
}

# Copies the plugin+field config into place before `rime init` runs, so init's own generate()
# picks it up. Target dir defaults to the CLI's own default (src/+rime) — pass a different one
# for a pass that also customizes RIME_CONFIG_DIR, or init's setConfig() won't find this file
# and will silently scaffold a fresh, plugin-less default config at the custom path instead.
# `bun` as the second argument reads the database with bun:sqlite, as `rime init --bun` would
# have written it: the copied config keeps init from writing its own.
copy_plugin_config() {
  local config_dir=${1:-src/+rime}
  local runtime=${2:-node}
  mkdir -p "$WORK_DIR/$config_dir"
  cp -rf "$ROOT_DIR/tests/consumer/+rime/"* "$WORK_DIR/$config_dir/"
  # The front page imports rimecms/public, what verify_public_chunks checks after the build. The
  # routes under /cache answer with and without a cache-control of their own.
  cp -rf "$ROOT_DIR/tests/consumer/routes/"* "$WORK_DIR/src/routes/"
  if [[ $runtime == "bun" ]]; then
    local config="$WORK_DIR/$config_dir/rime.config.server.ts"
    sed -i.bak "s/adapterSqlite('consumer.sqlite')/adapterSqlite('consumer.sqlite', { driver: 'bun' })/" "$config"
    rm -f "$config.bak"
    grep -q "driver: 'bun'" "$config" || { echo "could not set the bun driver in $config"; exit 1; }
  fi
}

# Verifies the plugin+field config actually mounted: schema + db table. Config dir defaults to
# the CLI's own default (src/+rime) — pass a different one to match a pass that also customizes
# RIME_CONFIG_DIR, and to confirm generation landed there (not at the stale default location).
verify_plugin_mounted() {
  local config_dir=${1:-src/+rime}
  (
    cd "$WORK_DIR"

    # Schema always lands here. A prototype's table is exported under its SQL name, so the
    # `pluginVisits` collection is `plugin_visits` — see adapter-sqlite/naming.server.ts.
    SCHEMA_FILE="$config_dir.generated/schema.server.ts"
    grep -q "sqliteTable( *'plugin_visits'" "$SCHEMA_FILE" || {
      echo "generated schema is missing the plugin's plugin_visits table"
      cat "$SCHEMA_FILE"
      exit 1
    }

    # Confirms drizzle-kit's migration actually created the table.
    TABLE=$(sqlite3 db/consumer.sqlite "SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_visits';" 2>/dev/null || true)
    [[ -n "$TABLE" ]] || { echo "plugin_visits table missing from db/consumer.sqlite after rime init"; exit 1; }
  )
}

# What a visitor loads without signing in: the front page no panel, no config and no auth client;
# the sign-in pages no config and none of the signed-in panel. verify-public-chunks.mjs reads the
# source maps of the chunks each loads; the build has source maps on for that.
verify_public_chunks() {
  (
    cd "$WORK_DIR"
    node "$ROOT_DIR/src/scripts/verify-public-chunks.mjs"
  )
}

# A fresh app with one package manager, dev then prod. npm and pnpm run on Node; bun is the
# Bun pack, vite and the built server on Bun.
run_pass() {
  local pm=$1
  local runtime="node"
  [[ $pm == "bun" ]] && runtime="bun"
  local dev_port prod_port
  case "$pm" in
    npm) dev_port=5181; prod_port=3101 ;;
    pnpm) dev_port=5182; prod_port=3102 ;;
    bun) dev_port=5183; prod_port=3103 ;;
  esac
  WORK_DIR="$RUN_DIR/$APP_NAME-$pm"

  log "[$pm] Scaffolding fresh SvelteKit app"
  cd "$RUN_DIR"
  case "$pm" in
    npm) npx sv create --template minimal --types ts --add eslint --install npm "$APP_NAME-$pm" ;;
    pnpm) pnpm dlx sv create --template minimal --types ts --add eslint --install pnpm "$APP_NAME-$pm" ;;
    bun) bunx sv create --template minimal --types ts --add eslint --install bun "$APP_NAME-$pm" ;;
  esac
  cd "$WORK_DIR"

  log "[$pm] Installing packed rimecms, plugin and field"
  case "$pm" in
    npm) npm install "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE" ;;
    pnpm) pnpm add "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE" ;;
    bun) bun add "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE" ;;
  esac

  # The plugin+field config goes in before init, so init's own generate() mounts them cold
  log "[$pm] Copying plugin+field config, running rime init"
  copy_plugin_config src/+rime "$runtime"
  case "$pm" in
    npm) npx rime init -n "$APP_NAME" ;;
    pnpm) pnpm exec rime init -n "$APP_NAME" ;;
    bun) bunx rime init --bun -n "$APP_NAME" ;;
  esac

  log "[$pm] Verifying plugin + field mounted"
  verify_plugin_mounted

  local vite="./node_modules/.bin/vite"
  [[ $runtime == "bun" ]] && vite="bun --bun ./node_modules/.bin/vite"
  log "[$pm] UI tests (dev, :$dev_port)"
  run_ui_tests \
    "http://localhost:$dev_port" \
    "$vite dev --port $dev_port --strictPort 2>&1 | tee \"$WORK_DIR/dev.log\"" \
    "$WORK_DIR" \
    "$dev_port" \
    "dev"

  log "[$pm] Building for production"
  cd "$WORK_DIR"
  # Source maps name the modules in each chunk, which verify_public_chunks reads.
  sed -i.bak "s/defineConfig({/defineConfig({ build: { sourcemap: true },/" vite.config.ts
  rm -f vite.config.ts.bak
  grep -q "sourcemap: true" vite.config.ts || { echo "could not turn source maps on in vite.config.ts"; exit 1; }
  case "$pm" in
    npm) npx rime build -d -e -s ;;
    pnpm) pnpm exec rime build -d -e -s ;;
    bun) bunx rime build -d -e -s ;;
  esac
  log "[$pm] Verifying what a visitor loads"
  verify_public_chunks
  cd app

  if [[ $pm == "npm" ]]; then
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
  fi

  case "$pm" in
    npm) npm install serve-static sharp ;;
    pnpm) pnpm add serve-static sharp ;;
    bun) bun add serve-static sharp ;;
  esac

  # envProduction() must carry RIME_PANEL_ROUTE through, or _live preview URLs silently fall
  # back to the default 'panel' segment in production under a customized route.
  grep -q '^RIME_PANEL_ROUTE=' .env || { echo "app/.env is missing RIME_PANEL_ROUTE"; exit 1; }

  # Bun loads ./.env itself
  local server="node --env-file=.env index.js"
  [[ $runtime == "bun" ]] && server="bun index.js"
  log "[$pm] UI tests (production, :$prod_port)"
  run_ui_tests \
    "http://localhost:$prod_port" \
    "PORT=$prod_port HOST=localhost $server 2>&1 | tee \"$WORK_DIR/app/prod.log\"" \
    "$WORK_DIR/app" \
    "$prod_port" \
    "prod"
}

# CUSTOM ROUTE + CONFIG DIR (npm, dev only)
# Proves RIME_PANEL_ROUTE and RIME_CONFIG_DIR both take when set as a shell-prefixed env var
# on `rime init` itself (they're read once at process start, and only override the .env file
# on a project's *first* init — setEnv() is add-only, so this only works against a project
# with no existing .env, which is exactly what a fresh scaffold is). Dev-only and no separate
# prod build: a route/config-dir change requires a fresh rime init/generate before it's picked
# up by any build anyway, and that's already what this pass does; re-verifying the npm/pnpm/bun
# split or a second production build here would just re-test what the other passes cover.
run_custom_route_pass() {
  local dev_port=5184
  WORK_DIR="$RUN_DIR/$APP_NAME-custom-route"

  log "[custom-route] Scaffolding fresh SvelteKit app (custom panel route + config dir)"
  cd "$RUN_DIR"
  npx sv create --template minimal --types ts --add eslint --install npm "$APP_NAME-custom-route"
  cd "$WORK_DIR"

  log "[custom-route] Installing packed rimecms, plugin and field"
  npm install "$TARBALL" "$PLUGIN_PACKAGE" "$FIELD_PACKAGE"

  # The plugin+field config goes into the *custom* config dir before init, so init's own
  # generate() mounts them cold at the right location.
  log "[custom-route] Copying plugin+field config, running rime init with RIME_PANEL_ROUTE + RIME_CONFIG_DIR"
  copy_plugin_config "$CUSTOM_CONFIG_DIR"
  # Init with the default panel route, then move it in .env as a user would: the dev boot below
  # has to regenerate the routes for it, the panel route being part of the codegen memo
  RIME_PANEL_ROUTE=panel RIME_CONFIG_DIR="$CUSTOM_CONFIG_DIR" npx rime init -n "$APP_NAME"
  sed -i.bak "s/^RIME_PANEL_ROUTE=.*/RIME_PANEL_ROUTE=$CUSTOM_PANEL_ROUTE/" .env
  rm -f .env.bak

  # Confirms the custom .env values actually stuck and generation landed under the custom dir,
  # not silently at the CLI's default (src/+rime) — the failure mode if copy_plugin_config or
  # setConfig() ever regress to ignoring RIME_CONFIG_DIR.
  grep -q "^RIME_PANEL_ROUTE=$CUSTOM_PANEL_ROUTE$" .env || { echo ".env's RIME_PANEL_ROUTE wasn't set to $CUSTOM_PANEL_ROUTE"; exit 1; }
  grep -q "^RIME_CONFIG_DIR=$CUSTOM_CONFIG_DIR$" .env || { echo ".env's RIME_CONFIG_DIR wasn't set to $CUSTOM_CONFIG_DIR"; exit 1; }
  [[ -d "$CUSTOM_CONFIG_DIR.generated" ]] || { echo "$CUSTOM_CONFIG_DIR.generated is missing - config didn't generate at the custom dir"; exit 1; }
  [[ -d "src/+rime.generated" ]] && { echo "src/+rime.generated exists - generation fell back to the default dir instead of $CUSTOM_CONFIG_DIR"; exit 1; }

  log "[custom-route] Verifying plugin + field mounted at the custom config dir"
  verify_plugin_mounted "$CUSTOM_CONFIG_DIR"

  # consumer.test.ts reused as-is (its panelUrl()/panelUrlRe() helpers read RIME_PANEL_ROUTE
  # from tests/util.ts), plus the dedicated custom-route assertions.
  log "[custom-route] UI tests (dev, :$dev_port, custom panel route)"
  run_ui_tests \
    "http://localhost:$dev_port" \
    "./node_modules/.bin/vite dev --port $dev_port --strictPort 2>&1 | tee \"$WORK_DIR/dev.log\"" \
    "$WORK_DIR" \
    "$dev_port" \
    "custom-route" \
    'consumer\.test\.ts$|consumer-custom-panel-route\.test\.ts$' \
    "$CUSTOM_PANEL_ROUTE"
}

# Runs a pass in the background, its output in $RUN_DIR/<pass>.log and its exit code in
# $RUN_DIR/<pass>.status. A failing command stops the pass, not the others.
start_pass() {
  local pass=$1
  log "[$pass] started - $RUN_DIR/$pass.log"
  {
    set +e
    started=$SECONDS
    (
      set -e
      case "$pass" in
        custom-route) run_custom_route_pass ;;
        *) run_pass "$pass" ;;
      esac
    ) > "$RUN_DIR/$pass.log" 2>&1
    status=$?
    echo "$status" > "$RUN_DIR/$pass.status"
    took="$(( (SECONDS - started) / 60 ))m$(( (SECONDS - started) % 60 ))s"
    if [[ $status -eq 0 ]]; then echo " [✓] $pass passed in $took"; else echo " [x] $pass failed in $took"; fi
  } &
}

# Packing rime

if [[ $SKIP_PACK -eq 1 ]]; then
  log "--skip-pack: reusing newest rimecms-*.tgz"
  TARBALL=$(ls -t "$ROOT_DIR"/rimecms-*.tgz 2>/dev/null | head -1 || true)
  [[ -f "$TARBALL" ]] || { echo "--skip-pack: no rimecms-*.tgz found at $ROOT_DIR - run once without --skip-pack first"; exit 1; }
  echo "    reusing $TARBALL"
else
  log "Packing local package (bun run local-pack)"
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

rm -rf "$RUN_DIR"
mkdir -p "$RUN_DIR"
for pass in ${ONLY//,/ }; do
  while (( $(jobs -rp | wc -l) >= JOBS )); do sleep 1; done
  start_pass "$pass"
done
wait

FAILED=0
for pass in ${ONLY//,/ }; do
  [[ "$(cat "$RUN_DIR/$pass.status" 2>/dev/null)" == 0 ]] && continue
  FAILED=1
  echo ""
  echo "[x] $pass failed - workspace kept at $RUN_DIR/$APP_NAME-$pass"
  echo "--- last 60 lines of $RUN_DIR/$pass.log ---"
  tail -60 "$RUN_DIR/$pass.log"
done
[[ $FAILED -eq 0 ]] || exit 1

echo ""

# Clean up
if [[ $KEEP_ON_SUCCESS -eq 1 ]]; then
  echo "[✓] consumer test passed ($ONLY) - workspaces kept at $RUN_DIR (--keep)"
else
  rm -rf "$RUN_DIR"
  [[ -n "$TARBALL" && $SKIP_PACK -eq 0 ]] && rm -f "$TARBALL"
  echo "[✓] consumer test passed ($ONLY), workspaces cleaned"
fi

log "All good."
