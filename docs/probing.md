# Probing without the e2e suite

`bun run test` is 375 Playwright tests across six fixtures and it has **never run in this
container** — no SMTP sink, and Chromium is revision 1194 where Playwright 1.62 wants 1234. That
is not the reason this file exists, though. Even with the suite green, most of the failures this
restructure actually produced were **invisible to every static gate and to the suite alike**, and
were caught by a booted server and four curl calls.

This is the toolbox. Each section says what the tool discriminates — what class of failure it
catches that nothing else does.

---

## The one-paragraph version

```bash
bun run rime:use versions          # swap fixture (recreates the database)
git checkout hooks.generated.md    # rime:use deletes it — restore before you stage anything
bun run dev &                      # ~25s to first response
curl -c c.txt -X POST localhost:5173/api/init -H 'content-type: application/json' \
  -d '{"email":"admin@test.com","name":"Admin","password":"Str0ngPass!word"}'
curl -sg -b c.txt "localhost:5173/api/news?draft=true"
```

Note `-g` on every URL carrying a query filter. See **Traps** below; it cost half an hour.

---

## 1. The static gates, and what each cannot see

| gate        | command                        | catches                              | blind to                                |
| ----------- | ------------------------------ | ------------------------------------ | --------------------------------------- |
| types       | `bun run check`                | signature drift                      | anything resolved at runtime            |
| lint        | `bunx eslint src/lib`          | unused imports, hook rules           | everything structural                   |
| cycles      | `bun run check:circular-deps`  | new import cycles                    | a cycle that already existed reordering |
| unit        | `bunx vitest run`              | what a spec asserts                  | what no spec asserts                    |
| schema      | golden diff (§3)               | a column moved, dropped or reordered | anything not in the schema              |
| hooks chart | `hooks.generated.md` diff (§4) | pipeline order                       | a hook that does not run at all         |

**Baselines are per fixture.** Comparing across two reads as a regression that is not there.
Current, on this branch:

| fixture              | `bun run check`                                                  | files scanned |
| -------------------- | ---------------------------------------------------------------- | ------------- |
| `basic`              | **13** (6 in `src/lib`, 7 in the fixture's own `(front)/` pages) | 6563          |
| `versions`           | **0**                                                            | 6563          |
| `versions-multilang` | **6** (that fixture's own `(front)/` pages)                      | 6558          |

`bunx eslint src/lib` 21 · `check:circular-deps` **3** (and the _list_ matters more than the
count) · `bunx vitest run` **124**.

### The gap all six share

Commit 11b added one feature to a prototype's list. That reordered the module graph enough that
both config factories read the prototype through a `{ ...base }` spread at module scope and got a
definition **without `features`** — so every feature hook stopped running.

> `check`, `eslint`, `madge`, the unit suite, the generated schema **and the generated hooks
> chart** were all byte-identical to baseline.

The chart is built from the config, not from what boots. Only a live read caught it: documents
came back with no `title` and no `url`. **Boot and read a document before believing a green run.**

---

## 2. The booted server

```bash
bun run dev > /tmp/dev.log 2>&1 &
sleep 25          # first boot compiles; a warm one is ~10s
tail -20 /tmp/dev.log
```

`/tmp/dev.log` is a probe in itself. It prints every request with its method and path, and
`ERROR 404 — not_found` / stack traces land there, not in the curl output.

**Kill it in a Bash call of its own.** `pkill -f "vite dev"` matches the tool's own shell command
line and takes the shell down with it (exit 144). `pkill -x node` after the process list confirms
what is running is the safe form.

### Boot is itself a gate

Three of the six bugs in `28143da` appeared only here: duplicate fields rejected at validation,
areas 404ing because boot iterated the wrong registry, and a definition that had silently lost its
hooks. The boot log's `Config is valid` line is the first of them.

---

## 3. The golden schema

The gate for **field order is column order**, and the only thing that catches a shadow that
silently stopped being generated.

```bash
# capture, per fixture, BEFORE the change
for f in basic versions versions-multilang; do
  bun run rime:use $f && git checkout hooks.generated.md
  bun run dev > /tmp/dev-$f.log 2>&1 &
  sleep 15 && curl -s -o /dev/null localhost:5173/ && sleep 3
  cp src/lib/+rime.generated/schema.server.ts /tmp/schema.$f.before.ts
  pkill -x node
done
# … make the change, repeat into .after.ts …
diff /tmp/schema.$f.before.ts /tmp/schema.$f.after.ts
```

Three fixtures because each exercises something the others do not: `basic` has no versions at all,
`versions` has versioned collections _and_ areas plus a nested one, `versions-multilang` adds the
locales branch on top of the shadow — 25 tables, every hard case at once.

**Never `rm` the schema to force regeneration.** Vite requires the file to exist at boot and dies
with _"Unable to find schema, did you run rime init"_. Codegen overwrites it in place. Codegen
also memoises: `rm node_modules/.rime/config.txt` forces a run.

---

## 4. The hooks chart

```bash
RIME_GENERATE_HOOKS_CHART=true bun run dev
```

Writes `hooks.generated.md` at the repo root, a tree of every prototype's resolved pipeline with
each hook **tagged by the feature that contributed it**. Untagged means core.

That tagging is the diagnostic. The 500 on a new draft for a nested versioned collection was found
here: the derived `$pages__versions` collection's hooks showed up **untagged**, which meant the
shadow had inherited its parent's already-resolved `$hooks` and `buildPipeline` was appending them
as the _consumer's_ hooks. `$settings__versions` also ran every core step twice, visible as a
duplicated subtree.

Traps: it is committed from the **`basic`** fixture, so regenerate it there or the diff is a
fixture swap; `rime:use` deletes it, and `git add -A` then stages the deletion.

---

## 5. HTTP probes

The request shapes, each of which cost a 400 or a 404 the first time.

```bash
# seed the admin. The password must pass the field validator — a weak one comes back as
# "Field name is not valid", because validateForm reports the password failure under `name`.
curl -c c.txt -X POST localhost:5173/api/init -H 'content-type: application/json' \
  -d '{"email":"admin@test.com","name":"Admin","password":"Str0ngPass!word"}'
curl -c c.txt -b c.txt -X POST localhost:5173/api/auth/sign-in/email \
  -H 'content-type: application/json' \
  -d '{"email":"admin@test.com","password":"Str0ngPass!word"}'
```

`rime:use` recreates the database, so the admin is gone after every fixture swap.

### The kind probes — both prototypes, every time

```bash
curl -sg -b c.txt localhost:5173/api/pages          # collection
curl -sg -b c.txt localhost:5173/api/settings       # area
```

An unauthenticated read is a probe of its own: `/api/pages` 200s on `basic` and an area 403s.
**403 is the healthy answer**; the 404 commit 9's boot bug produced is what to watch for.

### The document-shape probe

Create a page and check `title`, `url`, `_type`, `_thumbnail`, `_children`. Missing `title` and
`url` on an otherwise 200 response is the signature of a definition that lost its `features`.

```bash
curl -sg -b c.txt -X POST localhost:5173/api/pages -H 'content-type: application/json' \
  -d '{"attributes":{"title":"Probe","slug":"probe"}}'
```

Fields go under `attributes` on the `basic` and `versions` fixtures — that is the config's group
field, not an API convention. Read the fixture's `rime.config.server.ts` before guessing.

### The upload probe, and why it discriminates hardest

A **base64** `POST /api/medias` must return `filename`, `mimeType`, `filesize`, all five image
sizes, `_path` and `_thumbnail`.

```
{"file":{"base64":"data:image/jpeg;base64,…","filename":"x.jpg","mimeType":"image/jpeg"},"alt":"…"}
```

`file` is a `JsonFile` object, not a bare data URI. A **multipart** upload does not go through
`castBase64ToFile`, so it legitimately leaves `mimeType` null — do not read that as a regression.

### The versions flow

The sequence that exercises the shadow table, the base/shadow field split, the `ownerId` FK, the
published-or-latest pick and the demotion, in five calls:

```bash
# 1. create published
N=$(curl -sg -b c.txt -X POST localhost:5173/api/news -H 'content-type: application/json' \
     -d '{"attributes":{"title":"Flow One","slug":"flow-one"},"status":"published"}')
NID=$(echo "$N" | python3 -c "import sys,json;print(json.load(sys.stdin)['doc']['id'])")

# 2. draft-edit — creates a second shadow row
curl -sg -b c.txt -X PATCH "localhost:5173/api/news/$NID?draft=true" \
  -H 'content-type: application/json' -d '{"attributes":{"title":"Flow One v2"}}'

# 3. the pick: no draft flag returns v1, draft=true returns v2
curl -sg -b c.txt "localhost:5173/api/news/$NID"
curl -sg -b c.txt "localhost:5173/api/news/$NID?draft=true"

# 4. the shadow rows themselves, through the derived collection
curl -sg -b c.txt "localhost:5173/api/news--versions?where[ownerId][equals]=$NID&select=status"

# 5. publish the draft — exactly one row may be published afterwards
VID=$(curl -sg -b c.txt "localhost:5173/api/news/$NID?draft=true" \
      | python3 -c "import sys,json;print(json.load(sys.stdin)['doc']['versionId'])")
curl -sg -b c.txt -X PATCH "localhost:5173/api/news/$NID?versionId=$VID" \
  -H 'content-type: application/json' -d '{"status":"published"}'
```

The derived shadow collection is reachable at its kebab slug: `$news__versions` → `news--versions`
(`$` dropped, `__` → `--`; see `core/prototype/naming.ts`).

### What each versions probe discriminates

| probe                                              | what breaks it                                  |
| -------------------------------------------------- | ----------------------------------------------- |
| `POST` a versioned doc, then `GET` it              | the shadow join, `insert` returning both ids    |
| `PATCH ?draft=true`, then `GET` both ways          | the published-or-latest pick                    |
| publish the second draft, list the shadow          | the demotion — exactly one published at a time  |
| a **nested** versioned parent, then a new draft    | the derived shadow's own pipeline (the old 500) |
| a doc with blocks or a relation, updated **twice** | children written against the wrong owner        |

The last one is the reason to care: an owner-id mistake is invisible on a single write and
duplicates the children on the second.

---

## 6. Proving a defect pre-existing

The single most useful technique here, and the one that stops a wrong fix.

```bash
pkill -x node                                        # free the port first, own Bash call
git stash push -m probe -- src/lib/core src/lib/adapter-sqlite
bun run dev > /tmp/dev-head.log 2>&1 & sleep 25
# … re-run the exact same probe …
pkill -x node
git stash pop
```

The database survives the restart, so documents created before the stash are still there and the
probe is genuinely the same probe. Used twice this session: the 500 on a nested versioned draft
(pre-existing, then fixed) and `PATCH ?draft=true` returning 404 on a doc with no published
version (pre-existing, still open — see `docs/known-defects.md`).

The type-level equivalent, for a count that moved:

```bash
git stash push -- src/lib && bun run check | tail -2 && git stash pop
```

---

## Traps

- **`curl` globs `[` and `]`.** Every filtered query — `?where[ownerId][equals]=…` — needs
  **`-g`** or curl fails before sending and prints nothing at all. An empty response body and an
  empty status code together mean this, not a dead server.
- **A list endpoint hides drafts.** `GET /api/pages` returns `{"docs":[]}` for a collection whose
  documents are all drafts. That is the published-or-latest pick doing its job; add `?draft=true`.
- **`PATCH` with no `versionId` targets the published version.** On a document that has never been
  published it 404s — including with `?draft=true`. The e2e suite always publishes first, so this
  path is untested. Publish, then draft-edit.
- **`rime:use` deletes `hooks.generated.md`**, and `git add -A` stages the deletion. Restore it
  with `git checkout hooks.generated.md` in the same breath as the swap.
- **Interrupting `rime:use`** between its `clear --force` and its `init` leaves the repo without
  `src/hooks.server.ts` and vite refuses to boot. Re-running it repairs it.
- **The `$rime/modules` boot warning** about `core/plugins/cache` exporting `toHash` from its
  server half only is legal and intentional. The warning exists so an asymmetry that _does_ break
  shows up.

---

## 7. Loading the panel in a browser

The one probe `curl` cannot stand in for, and the only one that catches a **server-only module in
the client graph**. The panel is CSR-only, so `curl /panel` returns the bootstrap script whatever
is broken; the failure is a 500 on a module request, and only a browser makes those.

Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (Playwright 1.62 wants 1234,
so drive `playwright-core` directly rather than through `@playwright/test`):

```js
const page = await (
  await (await chromium.launch({ executablePath: CHROME })).newContext()
).newPage();
page.on('response', (r) => {
  if (r.status() >= 500) console.log(r.url());
});
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
// sign in at /panel/sign-in, then visit /panel, /panel/<a collection>, /panel/<an area>
```

What it discriminates: every 500 is a `.server.ts` file SvelteKit refused to serve to the browser,
and the URL names the file. **Read the URLs, not the message** — SvelteKit's guard walks the
importer chain to print a "Cannot import X into code that runs in the browser" pyramid, follows one
arbitrary branch, and when that branch dead-ends before a route entrypoint it throws
`An impossible situation occurred` instead (`vite/index.js:798`). That string means the guard
fired, not that anything is unknowable.

Screenshot each page: a green console with an empty page is its own failure.

---

## What still needs the e2e suite

Nothing above covers the panel's interactions, the sign-in form, or the api-key tests (which need
the SMTP sink on `127.0.0.1:1025`, implicit TLS — **verify it with a real `smtplib.SMTP_SSL` login
and send, never `pgrep -f sink.py`**, which matches its own command line and always succeeds).
Chromium needs a temporary `launchOptions.executablePath` in `tests/playwright.config.base.ts`.
**Never commit it.**
