#!/usr/bin/env bash
# Compares two or more rimecms releases on the same consumer app: codegen, dev boot, and the
# REST API's reads and updates. Everything happens outside this repository, in a throwaway
# SvelteKit app per version, and nothing is written back here.
#
# Usage: bash src/scripts/perf-bench.sh rimecms@0.29.0 rimecms@0.33.0
#        bash src/scripts/perf-bench.sh rimecms@0.29.0 ./rimecms-0.34.0.tgz     # `npm pack` of a branch
#          [--runs 5] [--pages 100] [--cache] [--base-dir <path>] [--keep]
#
#   <spec>       an npm spec (rimecms@0.29.0, rimecms@latest) or a tarball from `npm pack`
#   --runs       how many times codegen, boot and the page passes are timed; the first boot is
#                the cold one, the median of the rest is the warm one (default 5)
#   --pages      how many pages perf-ops.ts creates, reads, lists and updates, --runs times (default 100)
#   --cache      turn the API cache on — RIME_CACHE_ENABLED=true in the app's .env, and every
#                request cached, signed in or not; the "again" passes then hit it
#   --base-dir   where the apps are scaffolded (default $HOME/perf-bench)
#   --keep       keep the apps afterwards
#
# Needs: npm, npx, bun, curl, perl. Port 5173 must be free.
set -euo pipefail

ROOT_DIR="$(pwd)"
BASE_DIR="$HOME/perf-bench"
RUNS=5
PAGES=100
CACHE=0
KEEP=0
SPECS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --runs) RUNS="$2"; shift 2 ;;
    --pages) PAGES="$2"; shift 2 ;;
    --cache) CACHE=1; shift ;;
    --base-dir) BASE_DIR="$2"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    *) SPECS+=("$1"); shift ;;
  esac
done
[[ ${#SPECS[@]} -ge 2 ]] || { echo "Give at least two specs to compare, e.g. rimecms@0.29.0 rimecms@0.33.0"; exit 1; }
for tool in npm npx bun curl perl; do
  command -v "$tool" >/dev/null || { echo "$tool is required"; exit 1; }
done

# The CLI's own defaults, not this repo's .env leaking into the scaffolded apps.
unset RIME_CONFIG_DIR
unset RIME_PANEL_ROUTE

APP_NAME="perf"
URL="http://localhost:5173"
ADMIN_EMAIL="${TESTS_ADMIN_EMAIL:-admin@email.com}"
ADMIN_PASSWORD="${TESTS_ADMIN_PASSWORD:-a&1Aa&1A}"
RESULTS=()

log() {
  echo "——————————————————————————————————————————"
  echo " ⚡︎ $*"
}

now_ms() { perl -MTime::HiRes=time -e 'printf "%.0f", time * 1000'; }

median() { sort -n | awk '{ a[NR] = $1 } END { print (NR % 2) ? a[(NR + 1) / 2] : (a[NR / 2] + a[NR / 2 + 1]) / 2 }'; }

stop_server() {
  pkill -f "vite dev --port 5173" 2>/dev/null || true
  for _ in $(seq 1 50); do
    curl -s -o /dev/null "$URL/" 2>/dev/null || return 0
    sleep 0.2
  done
}

cleanup() {
  local status=$?
  stop_server
  if [[ $status -ne 0 ]]; then
    echo ""
    echo "[x] bench failed (exit $status) - apps kept under $BASE_DIR"
    for name in init generate dev; do
      [[ -f "$BASE_DIR/current/$name.log" ]] && { echo "--- last 30 lines of $name.log ---"; tail -30 "$BASE_DIR/current/$name.log"; }
    done
  fi
  exit $status
}
trap cleanup EXIT

# The same config for every version: fields both sides have had since before 0.29, one blocks
# field so a child table is in play, one relation so the junction is, and public reads for the
# anonymous passes. With --cache the
# cache answers every request; its default only caches anonymous ones.
write_config() {
  local target=$1
  local cache=""
  [[ $CACHE -eq 1 ]] && cache="  \$cache: { isEnabled: () => true },"
  cat > "$target" <<EOF
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
  \$adapter: adapterSqlite('perf.sqlite'),
$cache
  collections: [Pages]
});
EOF
}

# Starts the dev server and answers how long the sign-in page took to answer 200, in ms.
boot_ms() {
  local start
  start=$(now_ms)
  (./node_modules/.bin/vite dev --port 5173 > dev.log 2>&1 &)
  for _ in $(seq 1 900); do
    if [[ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/panel/sign-in" 2>/dev/null)" == "200" ]]; then
      echo $(( $(now_ms) - start ))
      return 0
    fi
    sleep 0.2
  done
  echo "dev server never answered on $URL" >&2
  return 1
}

bench_one() {
  local spec=$1
  local label
  label=$(basename "$spec" .tgz | tr '@/' '--')
  [[ -f "$spec" ]] && spec="$(cd "$(dirname "$spec")" && pwd)/$(basename "$spec")"

  local work_dir="$BASE_DIR/$label"
  rm -rf "$work_dir" "$BASE_DIR/current"
  mkdir -p "$BASE_DIR"

  log "[$label] Scaffolding a SvelteKit app"
  cd "$BASE_DIR"
  npx sv create --template minimal --types ts --add eslint --install npm "$label" > /dev/null
  ln -s "$work_dir" "$BASE_DIR/current"
  cd "$work_dir"

  log "[$label] Installing $spec"
  npm install "$spec" > /dev/null

  log "[$label] rime init"
  npx rime init -n "$APP_NAME" > init.log 2>&1

  # Wherever this version put its config, the bench one goes in its place. The database and
  # its migrations go too: the first codegen then starts from nothing, on every version alike,
  # instead of migrating init's default schema into this one.
  local config
  config=$(find src -name 'rime.config*.ts' -not -path '*generated*' | head -1)
  [[ -n "$config" ]] || { echo "rime init wrote no config file"; exit 1; }
  write_config "$config"
  rm -rf db
  # The handler reads the env var before the config's own function; false by default.
  if [[ $CACHE -eq 1 ]]; then
    grep -q '^RIME_CACHE_ENABLED=' .env && sed -i '' 's/^RIME_CACHE_ENABLED=.*/RIME_CACHE_ENABLED=true/' .env || echo 'RIME_CACHE_ENABLED=true' >> .env
  fi

  log "[$label] Codegen, $RUNS runs"
  local generate=()
  for _ in $(seq 1 "$RUNS"); do
    local start; start=$(now_ms)
    npx rime generate --force > generate.log 2>&1
    generate+=("$(( $(now_ms) - start ))")
  done
  local generate_ms; generate_ms=$(printf '%s\n' "${generate[@]}" | median)
  echo "    generate: ${generate[*]} → median $generate_ms ms"

  log "[$label] Boot, $RUNS runs"
  local boots=()
  for _ in $(seq 1 "$RUNS"); do
    boots+=("$(boot_ms)")
    stop_server
  done
  local boot_cold=${boots[0]}
  local boot_warm; boot_warm=$(printf '%s\n' "${boots[@]:1}" | median)
  echo "    boot: ${boots[*]} → cold $boot_cold ms, warm median $boot_warm ms"

  log "[$label] API, $PAGES pages"
  boot_ms > /dev/null
  curl -s -o /dev/null -X POST "$URL/api/init" \
    -H 'content-type: application/json' -H "origin: $URL" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"name\":\"Admin\",\"password\":\"$ADMIN_PASSWORD\"}"
  local ops
  ops=$(bun "$ROOT_DIR/src/scripts/perf-ops.ts" --url "$URL" --n "$PAGES" --runs "$RUNS" \
    --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD" | tee /dev/stderr | grep '^RESULT ' | sed 's/^RESULT //')
  stop_server

  RESULTS+=("{\"label\":\"$label\",\"generate\":$generate_ms,\"bootCold\":$boot_cold,\"bootWarm\":$boot_warm,\"ops\":$ops}")

  cd "$ROOT_DIR"
  [[ $KEEP -eq 1 ]] || rm -rf "$work_dir"
  rm -f "$BASE_DIR/current"
}

for spec in "${SPECS[@]}"; do
  bench_one "$spec"
done

log "Results"
RESULTS_JSON="[$(IFS=,; echo "${RESULTS[*]}")]" RUNS="$RUNS" PAGES="$PAGES" CACHE="$CACHE" bun -e '
  const rows = JSON.parse(process.env.RESULTS_JSON);
  const { RUNS, PAGES } = process.env;
  const ms = (v) => `${Math.round(v)} ms`;
  const col = (v) => String(v).padStart(16);
  const width = Math.max(...rows.map((r) => r.label.length), 8);
  const line = (label, ...cells) => console.log(label.padEnd(width) + cells.map(col).join(""));

  console.log(`codegen   rime generate --force, median of ${RUNS} runs`);
  console.log(`boot      vite dev until the panel answers; cold = first start, warm = median of the rest`);
  console.log(`pages     ${PAGES} pages created, then each read, then read again, then listed 20 at a time from ${PAGES} offsets, then listed again, then each updated; median of ${RUNS} runs`);
  console.log(`anon      the same reads and lists without signing in`);
  if (process.env.CACHE === "1") console.log(`cache     on for every request, emptied before each run: the "again" passes hit it`);
  console.log("");
  line("", "codegen", "boot cold", "boot warm", "create", "read", "read again", "read anon", "list", "list again", "list anon", "update");
  for (const r of rows) {
    const o = r.ops;
    line(r.label, ms(r.generate), ms(r.bootCold), ms(r.bootWarm), ms(o.create), ms(o.read), ms(o.readAgain), ms(o.readAnon), ms(o.list), ms(o.listAgain), ms(o.listAnon), ms(o.update));
  }
'
