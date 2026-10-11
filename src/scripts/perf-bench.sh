#!/usr/bin/env bash
# Compares two or more rimecms releases on the same consumer app, each on Node or on Bun: codegen,
# dev boot and the REST API on the dev server, then the build, the production boot and the same
# API on the built server. Everything happens outside this repository, in a throwaway SvelteKit
# app per spec, and nothing is written back here.
#
# Each spec runs on the SvelteKit its own `@sveltejs/kit` peer range asks for: a range on kit 2
# (rimecms@1.0.0: ^2.22.0) is scaffolded by sv 0.17.1 and gets @sveltejs/adapter-node 5, which
# its `rime init` keeps (on Bun through an `overrides` entry); any other range by sv 1.1.1, on
# kit 3.
#
# A published release is measured once. Its npm spec is resolved to the exact version
# (rimecms@1.1 -> the newest 1.1.x), and its row of results is saved in <base-dir>/baselines/,
# in a file named by everything that changes the numbers: the version, the runtime, --mode,
# --fixture, --runs, --pages and --cache. A later run with the same ones reads that row instead of
# measuring again, and labels it with the day it was measured: "rimecms-0.29.0 (saved
# 2026-10-11)". A tarball is measured every time.
#
# Usage: bash src/scripts/perf-bench.sh rimecms@0.29.0 rimecms@0.33.0
#        bash src/scripts/perf-bench.sh rimecms@0.33.0 ./rimecms-0.34.0.tgz:bun   # old on Node, new on Bun
#        bash src/scripts/perf-bench.sh ./rimecms-0.34.0.tgz ./rimecms-0.34.0.tgz:bun  # the runtime alone
#          [--bun] [--mode dev|prod|both] [--fixture pages|relations] [--runs 5] [--pages 100] [--cache]
#          [--base-dir <path>] [--keep] [--fresh] [--npm-force]
#
#   <spec>[:bun] an npm spec (rimecms@0.29.0, rimecms@latest) or a tarball from `npm pack`; `:bun`
#                runs it as the Bun pack (bun install, `rime init --bun`, bun:sqlite, vite and the
#                built server on Bun), else it runs on Node. Its peer range is read with
#                `npm view <spec> peerDependencies`, or from the tarball's package.json
#   --bun        every spec on Bun
#   --mode       dev: codegen, dev boot, API on the dev server; prod: build, production boot, API on
#                the built server; both (default)
#   --fixture    pages: one collection, the create, read, list and update passes (perf-ops.ts);
#                relations: authors, nested categories and pages with urls from their parents'
#                slugs, links and a menu, and reads at depth 0, 1 and 2 (perf-ops-relations.ts)
#   --runs       how many times codegen, boot and the page passes are timed; the first boot is
#                the cold one, the median of the rest is the warm one (default 5)
#   --pages      how many pages the passes create or read, and calls a pass makes (default 100)
#   --cache      turn the API cache on — RIME_CACHE_ENABLED=true in the app's .env, and every
#                request cached, signed in or not; the "again" passes then hit it
#   --base-dir   where the apps are scaffolded and the rows saved (default $HOME/perf-bench)
#   --keep       keep the apps afterwards
#   --fresh      measure every spec again, and save the published releases' rows over the old ones
#   --npm-force  every npm command runs with --force, `rime init`'s installs included: npm installs
#                a peer range no published version satisfies anyway, and still installs the other
#                peers
#
# Needs: npm, npx, bun, curl, perl. Ports 5173 and 3000 must be free.
set -euo pipefail

ROOT_DIR="$(pwd)"
BASE_DIR="$HOME/perf-bench"
RUNS=5
PAGES=100
CACHE=0
KEEP=0
FRESH=0
ALL_BUN=0
MODE="both"
FIXTURE="pages"
SPECS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --runs) RUNS="$2"; shift 2 ;;
    --pages) PAGES="$2"; shift 2 ;;
    --cache) CACHE=1; shift ;;
    --bun) ALL_BUN=1; shift ;;
    --mode) MODE="$2"; shift 2 ;;
    --fixture) FIXTURE="$2"; shift 2 ;;
    --base-dir) BASE_DIR="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    --fresh) FRESH=1; shift ;;
    # npm reads its config from npm_config_* variables, in this script and in every child it starts
    --npm-force) export npm_config_force=true; shift ;;
    *) SPECS+=("$1"); shift ;;
  esac
done
[[ ${#SPECS[@]} -ge 2 ]] || { echo "Give at least two specs to compare, e.g. rimecms@0.29.0 rimecms@0.33.0"; exit 1; }
[[ "$MODE" =~ ^(dev|prod|both)$ ]] || { echo "--mode is dev, prod or both"; exit 1; }
[[ "$FIXTURE" =~ ^(pages|relations)$ ]] || { echo "--fixture is pages or relations"; exit 1; }
for tool in npm npx bun curl perl; do
  command -v "$tool" >/dev/null || { echo "$tool is required"; exit 1; }
done

# The apps read their own .env, not this repo's one leaking in from the shell: a variable already
# set wins over .env, so PORT=5173 would put the built server on the dev port.
for name in $(env | grep -oE '^(RIME_[A-Z0-9_]*|PUBLIC_[A-Z0-9_]*|SMTP_[A-Z0-9_]*|BETTER_AUTH_[A-Z0-9_]*|SITE_URL|HOST|PORT|ORIGIN|BODY_SIZE_LIMIT)='); do
  unset "${name%=}"
done

APP_NAME="perf"
DEV_URL="http://localhost:5173"
PROD_URL="http://localhost:3000"
ADMIN_EMAIL="${TESTS_ADMIN_EMAIL:-admin@email.com}"
ADMIN_PASSWORD="${TESTS_ADMIN_PASSWORD:-a&1Aa&1A}"
RESULTS=()
# The last server started: boot_ms runs in a subshell, so its pid goes through a file.
PID_FILE="$BASE_DIR/server.pid"

log() {
  echo "——————————————————————————————————————————"
  echo " ⚡︎ $*"
}

now_ms() { perl -MTime::HiRes=time -e 'printf "%.0f", time * 1000'; }

median() { sort -n | awk '{ a[NR] = $1 } END { print (NR % 2) ? a[(NR + 1) / 2] : (a[NR / 2] + a[NR / 2 + 1]) / 2 }'; }

# Waits until nothing answers on the url.
wait_down() {
  for _ in $(seq 1 50); do
    curl -s -o /dev/null "$1/" 2>/dev/null || return 0
    sleep 0.2
  done
}

stop_dev() {
  pkill -f "vite dev --port 5173" 2>/dev/null || true
  wait_down "$DEV_URL"
}

stop_prod() {
  [[ -f "$PID_FILE" ]] && { kill "$(cat "$PID_FILE")" 2>/dev/null || true; rm -f "$PID_FILE"; }
  wait_down "$PROD_URL"
}

cleanup() {
  local status=$?
  stop_dev
  stop_prod
  if [[ $status -ne 0 ]]; then
    echo ""
    echo "[x] bench failed (exit $status) - apps kept under $BASE_DIR"
    for name in init generate dev build app/prod; do
      [[ -f "$BASE_DIR/current/$name.log" ]] && { echo "--- last 30 lines of $name.log ---"; tail -30 "$BASE_DIR/current/$name.log"; }
    done
  fi
  exit $status
}
trap cleanup EXIT

# The same config for every version, one per fixture. On Bun the adapter reads with bun:sqlite.
# With --cache the cache answers every request; its default only caches anonymous ones.
write_config() {
  local target=$1
  local runtime=$2
  local cache=""
  local driver=""
  [[ $CACHE -eq 1 ]] && cache="  \$cache: { isEnabled: () => true },"
  [[ $runtime == "bun" ]] && driver=", { driver: 'bun' }"
  if [[ $FIXTURE == "relations" ]]; then
    write_config_relations "$target" "$driver" "$cache"
  else
    write_config_pages "$target" "$driver" "$cache"
  fi
}

# Fields both sides have had since before 0.29: one blocks field so a child table is in play, one
# relation so the junction is, and public reads for the anonymous passes.
write_config_pages() {
  cat > "$1" <<EOF
import { Collection, rime } from '\$rime/config';
import { adapterSqlite } from 'rimecms/adapter-sqlite';
import { block, blocks, number, relation, text, textarea, toggle } from 'rimecms/fields';

const Pages = Collection.create('pages', {
  fields: [
    text('title').isTitle().required(),
    textarea('body'),
    toggle('published'),
    number('views'),
    blocks('layout', [block('paragraph').fields(textarea('text'))]),
    relation('related').to('pages').many()
  ],
  access: { read: () => true }
});

export default rime({
  \$adapter: adapterSqlite('perf.sqlite'$2),
$3
  collections: [Pages]
});
EOF
}

# Everything a read at depth follows: relations to three collections, a link in a block and in a
# tree, nested collections, and a url made of the parents' slugs.
write_config_relations() {
  cat > "$1" <<EOF
import { Area, Collection, rime } from '\$rime/config';
import { adapterSqlite } from 'rimecms/adapter-sqlite';
import { block, blocks, link, relation, slug, text, textarea, tree } from 'rimecms/fields';

const Authors = Collection.create('authors', {
  fields: [text('name').isTitle().required()],
  access: { read: () => true }
});

const Categories = Collection.create('categories', {
  nested: true,
  fields: [text('title').isTitle().required()],
  access: { read: () => true }
});

const Pages = Collection.create('pages', {
  nested: true,
  // Both signatures: a release with addresses passes { path, … }, an older one the document.
  \$url: (arg) => arg.path
    ? \`/\${arg.path.join('/')}\`
    : \`/[...parent.slug]/\${arg.slug}\`,
  fields: [
    text('title').isTitle().required(),
    slug('slug').slugify('title'),
    relation('author').to('authors'),
    relation('categories').to('categories').many(),
    relation('related').to('pages').many(),
    blocks('layout', [
      block('paragraph').fields(textarea('text')),
      block('cta').fields(text('label'), link('link').types('pages', 'url'))
    ])
  ],
  access: { read: () => true }
});

const Menu = Area.create('menu', {
  fields: [tree('nav').fields(link('link').types('pages', 'url'))],
  access: { read: () => true }
});

export default rime({
  \$adapter: adapterSqlite('perf.sqlite'$2),
$3
  collections: [Authors, Categories, Pages],
  areas: [Menu]
});
EOF
}

# The highest major the spec's `@sveltejs/kit` peer range names, empty without one:
# ^2.22.0 -> 2, ^2.22.0 || ^3.0.0 -> 3. An npm spec matching several versions gives a list:
# the last, newest one counts.
kit_major() {
  local spec=$1
  local json
  if [[ -f "$spec" ]]; then
    json=$(tar -xzOf "$spec" package/package.json)
  else
    json=$(npm view "$spec" peerDependencies --json)
  fi
  printf '%s' "$json" | node -e '
    const text = require("fs").readFileSync(0, "utf-8").trim();
    const parsed = text ? JSON.parse(text) : {};
    const latest = Array.isArray(parsed) ? parsed.at(-1) ?? {} : parsed;
    const range = (latest.peerDependencies ?? latest)["@sveltejs/kit"] ?? "";
    const majors = range
      .split(/\|\||\s+/)
      .map((part) => parseInt(part.replace(/^[\^~<>=v]+/, ""), 10))
      .filter((major) => !Number.isNaN(major));
    if (majors.length) console.log(Math.max(...majors));
  '
}

# Starts a server in the background and answers how long its sign-in page took to answer 200,
# in ms. The server's pid lands in PID_FILE.
boot_ms() {
  local url=$1
  local log_file=$2
  shift 2
  local start
  start=$(now_ms)
  "$@" > "$log_file" 2>&1 &
  echo $! > "$PID_FILE"
  for _ in $(seq 1 900); do
    if [[ "$(curl -s -o /dev/null -w '%{http_code}' "$url/panel/sign-in" 2>/dev/null)" == "200" ]]; then
      echo $(( $(now_ms) - start ))
      return 0
    fi
    sleep 0.2
  done
  echo "server never answered on $url" >&2
  return 1
}

# The first admin. /api/init only answers on the dev server.
create_admin() {
  local url=$1
  curl -s -o /dev/null -X POST "$url/api/init" \
    -H 'content-type: application/json' -H "origin: $url" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"name\":\"Admin\",\"password\":\"$ADMIN_PASSWORD\"}"
}

# The fixture's passes; prints their RESULT json.
api_ops() {
  local url=$1
  local cache_flag=()
  [[ $CACHE -eq 1 ]] && cache_flag=(--cache)
  local script="perf-ops.ts"
  [[ $FIXTURE == "relations" ]] && script="perf-ops-relations.ts"
  bun "$ROOT_DIR/src/scripts/$script" --url "$url" --n "$PAGES" --runs "$RUNS" \
    --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD" ${cache_flag[@]+"${cache_flag[@]}"} | tee /dev/stderr | grep '^RESULT ' | sed 's/^RESULT //'
}

# The exact release an npm spec names, the newest when it matches several:
# rimecms@1.1 -> rimecms@1.1.6, rimecms@latest -> rimecms@1.1.6.
resolve_spec() {
  npm view "$1" name version --json | node -e '
    const parsed = JSON.parse(require("fs").readFileSync(0, "utf-8"));
    const latest = Array.isArray(parsed) ? parsed.at(-1) : parsed;
    console.log(`${latest.name}@${latest.version}`);
  '
}

# Where the row of an exact release is saved, named by everything that changes its numbers:
# rimecms@0.29.0 on Node -> baselines/rimecms@0.29.0.node.both.pages.runs-5.pages-100.cache-0.json
baseline_file() {
  local spec=$1
  local runtime=$2
  local name="${spec//\//-}.$runtime.$MODE.$FIXTURE.runs-$RUNS.pages-$PAGES.cache-$CACHE"
  echo "$BASE_DIR/baselines/$name.json"
}

# A saved row, its label holding the day the file was written: "rimecms-0.29.0 (saved 2026-10-11)".
saved_row() {
  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const row = JSON.parse(fs.readFileSync(file, "utf-8"));
    const day = fs.statSync(file).mtime.toISOString().slice(0, 10);
    console.log(JSON.stringify({ ...row, label: `${row.label} (saved ${day})` }));
  ' "$1"
}

bench_one() {
  local spec=$1
  local runtime="node"
  [[ $ALL_BUN -eq 1 ]] && runtime="bun"
  case "$spec" in
    *:bun) runtime="bun"; spec=${spec%:bun} ;;
    *:node) runtime="node"; spec=${spec%:node} ;;
  esac

  # A published release: its exact version, and the row saved for it
  local saved=""
  if [[ ! -f "$spec" ]]; then
    spec=$(resolve_spec "$spec")
    saved=$(baseline_file "$spec" "$runtime")
  fi

  local label
  label=$(basename "$spec" .tgz | tr '@/' '--')
  [[ $runtime == "bun" ]] && label="$label-bun"
  [[ -f "$spec" ]] && spec="$(cd "$(dirname "$spec")" && pwd)/$(basename "$spec")"

  if [[ -n "$saved" && -f "$saved" && $FRESH -eq 0 ]]; then
    log "[$label] Saved row: $saved"
    RESULTS+=("$(saved_row "$saved")")
    return 0
  fi

  # rime on the runtime: codegen and the build's vite run where the app does.
  local rime_cli=(npx rime)
  local vite_dev=(./node_modules/.bin/vite dev --port 5173)
  local prod_server=(node --env-file=.env index.js)
  if [[ $runtime == "bun" ]]; then
    rime_cli=(bunx --bun rime)
    vite_dev=(bun --bun ./node_modules/.bin/vite dev --port 5173)
    # Bun loads ./.env itself
    prod_server=(bun index.js)
  fi

  local work_dir="$BASE_DIR/$label"
  rm -rf "$work_dir" "$BASE_DIR/current"

  # sv 0.17.1 scaffolds kit ^2.63, vite ^8 and vite-plugin-svelte ^7; sv 1.1.1 kit 3
  local kit
  kit=$(kit_major "$spec")
  local sv="sv@1.1.1"
  [[ $kit == 2 ]] && sv="sv@0.17.1"

  log "[$label] Scaffolding a SvelteKit ${kit:-3} app with $sv ($runtime)"
  cd "$BASE_DIR"
  if [[ $runtime == "bun" ]]; then
    bunx "$sv" create --template minimal --types ts --add eslint --install bun "$label" > /dev/null
  else
    npx "$sv" create --template minimal --types ts --add eslint --install npm "$label" > /dev/null
  fi
  ln -s "$work_dir" "$BASE_DIR/current"
  cd "$work_dir"

  log "[$label] Installing $spec"
  if [[ $runtime == "bun" ]]; then
    bun add "$spec" > /dev/null
    npx rime init --help 2>/dev/null | grep -q -- '--bun' ||
      { echo "$spec has no Bun pack (rime init --bun): run it on Node"; exit 1; }
  else
    npm install "$spec" > /dev/null
  fi

  # adapter-node 6 needs kit 3. `rime init` installs @sveltejs/adapter-node with no version: npm
  # keeps a declared ^5, bun moves to the newest unless an override holds it on 5.
  if [[ $kit == 2 ]]; then
    log "[$label] @sveltejs/adapter-node 5, for kit 2"
    if [[ $runtime == "bun" ]]; then
      bun add -D @sveltejs/adapter-node@5 > /dev/null
      node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
        pkg.overrides = { ...pkg.overrides, '@sveltejs/adapter-node': '^5.5.7' };
        fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
      "
    else
      npm install -D @sveltejs/adapter-node@5 > /dev/null
    fi
  fi

  log "[$label] rime init"
  if [[ $runtime == "bun" ]]; then
    bunx rime init --bun -n "$APP_NAME" > init.log 2>&1
  else
    npx rime init -n "$APP_NAME" > init.log 2>&1
  fi

  # Wherever this version put its config, the bench one goes in its place. The database and
  # its migrations go too: the first codegen then starts from nothing, on every version alike,
  # instead of migrating init's default schema into this one.
  local config
  config=$(find src -name 'rime.config*.ts' -not -path '*generated*' | head -1)
  [[ -n "$config" ]] || { echo "rime init wrote no config file"; exit 1; }
  write_config "$config" "$runtime"
  rm -rf db storage/sqlite
  # The handler reads the env var before the config's own function; false by default.
  if [[ $CACHE -eq 1 ]]; then
    grep -q '^RIME_CACHE_ENABLED=' .env && sed -i '' 's/^RIME_CACHE_ENABLED=.*/RIME_CACHE_ENABLED=true/' .env || echo 'RIME_CACHE_ENABLED=true' >> .env
  fi

  log "[$label] Codegen, $RUNS runs"
  local generate=()
  for _ in $(seq 1 "$RUNS"); do
    local start; start=$(now_ms)
    "${rime_cli[@]}" generate --force > generate.log 2>&1
    generate+=("$(( $(now_ms) - start ))")
  done
  local generate_ms; generate_ms=$(printf '%s\n' "${generate[@]}" | median)
  echo "    generate: ${generate[*]} → median $generate_ms ms"

  local dev="null"
  if [[ $MODE != "prod" ]]; then
    log "[$label] Dev boot, $RUNS runs"
    local boots=()
    for _ in $(seq 1 "$RUNS"); do
      boots+=("$(boot_ms "$DEV_URL" dev.log "${vite_dev[@]}")")
      stop_dev
    done
    local boot_cold=${boots[0]}
    local boot_warm; boot_warm=$(printf '%s\n' "${boots[@]:1}" | median)
    # One run has no warm boot but the cold one
    [[ -n "$boot_warm" ]] || boot_warm=$boot_cold
    echo "    boot: ${boots[*]} → cold $boot_cold ms, warm median $boot_warm ms"

    log "[$label] API on the dev server, $PAGES pages"
    boot_ms "$DEV_URL" dev.log "${vite_dev[@]}" > /dev/null
    create_admin "$DEV_URL"
    local ops; ops=$(api_ops "$DEV_URL")
    stop_dev
    dev="{\"bootCold\":$boot_cold,\"bootWarm\":$boot_warm,\"ops\":$ops}"
  fi

  local prod="null"
  if [[ $MODE != "dev" ]]; then
    # A database with the schema and the admin alone: the dev passes' pages stay out of the built
    # one.
    rm -rf db storage/sqlite
    "${rime_cli[@]}" generate --force > generate.log 2>&1
    boot_ms "$DEV_URL" dev.log "${vite_dev[@]}" > /dev/null
    create_admin "$DEV_URL"
    stop_dev

    log "[$label] Build"
    # A release with --with-storage copies the database with -w, one without it with -d. Older
    # releases have no --with-static: the bench serves no static file, it goes when there.
    local build_flags=(-e)
    if npx rime build --help 2>/dev/null | grep -q -- '--with-storage'; then
      build_flags+=(-w)
    else
      build_flags+=(-d)
    fi
    npx rime build --help 2>/dev/null | grep -q -- '--with-static' && build_flags+=(-s)
    local rime_build=(npx rime build "${build_flags[@]}")
    local vite_build=(./node_modules/.bin/vite build)
    if [[ $runtime == "bun" ]]; then
      rime_build=(bunx rime build "${build_flags[@]}")
      vite_build=(bun --bun ./node_modules/.bin/vite build)
    fi
    local start; start=$(now_ms)
    "${rime_build[@]}" > build.log 2>&1
    # Up to 0.29, rime build only packs ./build: the vite build is the app's own, before it.
    if [[ ! -f app/build/handler.js ]]; then
      "${vite_build[@]}" >> build.log 2>&1
      "${rime_build[@]}" >> build.log 2>&1
    fi
    [[ -f app/build/handler.js ]] || { echo "the build wrote no app/build/handler.js"; exit 1; }
    local build_ms=$(( $(now_ms) - start ))
    echo "    build: $build_ms ms"

    cd app
    # A tarball dependency written relative to the app sits one level up from ./app
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
      for (const key of ['dependencies', 'devDependencies']) {
        for (const [name, dep] of Object.entries(pkg[key] || {})) {
          if (typeof dep === 'string' && dep.startsWith('file:') && !dep.startsWith('file:/')) {
            pkg[key][name] = 'file:../' + dep.slice('file:'.length);
          }
        }
      }
      fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    # What this release's server needs, from its own next steps: polka and serve-static up to
    # 0.29, serve-static since.
    local add_deps
    add_deps=$(grep -E '^[[:space:]]+(npm install|bun add) ' ../build.log | grep -v -e '--production' -e '--omit' | head -1 |
      sed -E 's/^[[:space:]]+//' || true)
    if [[ -z "$add_deps" ]]; then
      add_deps="npm install serve-static sharp"
      [[ $runtime == "bun" ]] && add_deps="bun add serve-static sharp"
    fi
    echo "    $add_deps"
    eval "$add_deps" > /dev/null

    log "[$label] Production boot, $RUNS runs"
    local prod_boots=()
    for _ in $(seq 1 "$RUNS"); do
      prod_boots+=("$(boot_ms "$PROD_URL" prod.log "${prod_server[@]}")")
      stop_prod
    done
    local prod_cold=${prod_boots[0]}
    local prod_warm; prod_warm=$(printf '%s\n' "${prod_boots[@]:1}" | median)
    [[ -n "$prod_warm" ]] || prod_warm=$prod_cold
    echo "    boot: ${prod_boots[*]} → cold $prod_cold ms, warm median $prod_warm ms"

    log "[$label] API on the built server, $PAGES pages"
    boot_ms "$PROD_URL" prod.log "${prod_server[@]}" > /dev/null
    local prod_ops; prod_ops=$(api_ops "$PROD_URL")
    stop_prod
    cd "$work_dir"
    prod="{\"build\":$build_ms,\"bootCold\":$prod_cold,\"bootWarm\":$prod_warm,\"ops\":$prod_ops}"
  fi

  local row="{\"label\":\"$label\",\"generate\":$generate_ms,\"dev\":$dev,\"prod\":$prod}"
  RESULTS+=("$row")

  cd "$ROOT_DIR"
  if [[ -n "$saved" ]]; then
    mkdir -p "$(dirname "$saved")"
    echo "$row" > "$saved"
  fi
  [[ $KEEP -eq 1 ]] || rm -rf "$work_dir"
  rm -f "$BASE_DIR/current"
}

mkdir -p "$BASE_DIR"
for spec in "${SPECS[@]}"; do
  bench_one "$spec"
done

log "Results"
RESULTS_JSON="[$(IFS=,; echo "${RESULTS[*]}")]" RUNS="$RUNS" PAGES="$PAGES" CACHE="$CACHE" FIXTURE="$FIXTURE" bun -e '
  const rows = JSON.parse(process.env.RESULTS_JSON);
  const { RUNS, PAGES } = process.env;
  const ms = (v) => `${Math.round(v)} ms`;
  const col = (v) => String(v).padStart(14);
  const width = Math.max(...rows.map((r) => r.label.length), 8);
  const line = (label, ...cells) => console.log(label.padEnd(width) + cells.map(col).join(""));
  const again = process.env.CACHE === "1" ? "(cache)" : "again";
  const relations = process.env.FIXTURE === "relations";
  const passes = relations
    ? [["list d0", "listD0"], ["list d1", "listD1"], ["list d2", "listD2"], ["read d1", "readD1"], ["read d2", "readD2"], ["menu d1", "menuD1"], ["by url", "byUrl"]]
    : [["create", "create"], ["read", "read"], [`read ${again}`, "readAgain"], ["read anon", "readAnon"], ["list", "list"], [`list ${again}`, "listAgain"], ["list anon", "listAnon"], ["update", "update"]];
  const opsHeads = passes.map(([head]) => head);
  const perCall = (total, o) => `${(total / o.n).toFixed(1)} ms`;
  const opsCells = (o) => passes.map(([, key]) => perCall(o[key], o));

  console.log(`codegen   rime generate --force, median of ${RUNS} runs`);
  console.log(`boot      server started until the panel answers; cold = first start, warm = median of the rest`);
  console.log(`build     rime build (and vite build before it, up to 0.29), once`);
  console.log(`api       time per call, over ${PAGES} calls a pass, median of ${RUNS} runs:`);
  if (relations) {
    console.log(`          ${PAGES} pages 3 levels deep, each with an author, 2 categories, 2 related pages and a link`);
    console.log(`          list: 20 pages a call, from offsets 0 to ${PAGES - 1}; read: one page a call; d0-d2: the depth`);
    console.log(`          menu: an area holding a tree of 20 links to pages; by url: one page found by its url`);
  } else {
    console.log(`          create, read, update: one page a call; list: 20 pages a call, from offsets 0 to ${PAGES - 1}`);
    if (process.env.CACHE === "1") console.log(`          (cache): the same calls again, hitting the API cache, on for every request, emptied before each run`);
    else console.log(`          again: the same calls again; no cache but the default one, for signed-out requests`);
    console.log(`          anon: the same reads and lists, signed out`);
  }

  const devRows = rows.filter((r) => r.dev);
  if (devRows.length) {
    console.log("\nDev server (vite dev)\n");
    line("", "codegen", "boot cold", "boot warm", ...opsHeads);
    for (const r of devRows) line(r.label, ms(r.generate), ms(r.dev.bootCold), ms(r.dev.bootWarm), ...opsCells(r.dev.ops));
  }

  const prodRows = rows.filter((r) => r.prod);
  if (prodRows.length) {
    console.log("\nBuilt server (node index.js, bun index.js)\n");
    line("", "build", "boot cold", "boot warm", ...opsHeads);
    for (const r of prodRows) line(r.label, ms(r.prod.build), ms(r.prod.bootCold), ms(r.prod.bootWarm), ...opsCells(r.prod.ops));
  }
'
