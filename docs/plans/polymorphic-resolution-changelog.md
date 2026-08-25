# Polymorphic `$rime/<name>` resolution + config-mode consolidation

## The rule

`$rime/<name>` resolves relative to the package of whoever imports it. No name prefix, ever.

```ts
function resolveLibRoot(importer: string): string {
  const packageRoot = findPackageRoot(path.dirname(importer)); // walk up to nearest package.json
  const isBuilt = importer.includes(`${path.sep}node_modules${path.sep}`);
  return path.join(packageRoot, isBuilt ? 'dist' : 'src/lib');
}
```

## The only sanctioned uses of `$rime/<name>`

1. A lib (rime itself, or a third-party plugin/field package) splitting *its own* client/server
   behavior — the lib writes the `$rime/<name>` import, never the consumer.
2. `$rime/config` / `$rime/schema` — the only two names a *consumer* ever writes, reserved,
   special-cased before the general rule (always resolves to the active config/schema
   regardless of importer).
3. A consumer app's own local field/plugin splitting its own client/server behavior, same
   pattern as (1), just at the consumer's own root instead of a lib's.

A consumer app should never write `$rime/core/plugins/cache` or `$rime/plugin` directly —
those are a lib's own internal names. The intended pattern is always: `import { cache } from
'rimecms'` / `import { x } from '@bienbien/whatever'`, and the lib's own entry point does the
`$rime/<name>` split *internally*, invisibly to whoever imports it.

## Every case

Every `$rime/<name>` row below is a package **importing its own other half** — never one
package reaching into another. What varies is (a) which package's own file wrote the import,
and (b) what file path *Vite's resolver* reports as the importer when it asks — which is not
always that package's real source file. `rimecms`'s own `cache/index.ts` gets asked about
*twice* per dev session once installed: once with Vite reporting the real file, once with Vite
reporting a synthetic optimizer chunk — so it needs two rows, not one.

Context = whose node_modules tree Vite is actually resolving inside (i.e. which app is
running). Specifier owner = which package this `$rime/<name>` name belongs to — not who typed
the import, who it's *reserved for*. Owner and the actual writer match in every row except the
misuse row, where they don't — that mismatch is the whole bug being flagged.

| Context | Specifier | Specifier owner | Importer path | Correct root | Resolve process | Result |
|---|---|---|---|---|---|---|
| rime | `$rime/core/plugins/cache` | rime | `src/lib/...` | `src/lib` | walk up from importer → rime's own `src/lib` (primary) | ✅ |
| consumer-app | `$rime/core/plugins/cache` | rime | `node_modules/rimecms/dist/...` | `node_modules/rimecms/dist` | walk up from importer → rime's own `dist` (primary) | ✅ |
| consumer-app | `$rime/core/plugins/cache` | rime | `node_modules/.vite/deps/rimecms.js` | `node_modules/rimecms/dist` | walk up → `.vite/deps`'s own `package.json` → wrong root → **falls back to `nativeLibDir`** → rime's own `dist` | ✅ fallback |
| consumer-app | `$rime/plugin` | consumer-lib-A | `node_modules/@bienbien/rime-consumer-plugin/dist/...` | `node_modules/@bienbien/rime-consumer-plugin/dist` | walk up from importer → its own `dist` (primary) | ✅ |
| consumer-app | `$rime/plugin` | consumer-lib-A | `node_modules/.vite/deps/<pkg>.js` | `node_modules/@bienbien/rime-consumer-plugin/dist` | walk up → wrong root → falls back to `nativeLibDir`/`consumerLibDir` (neither is this package's own root) → **then `pluginLibDirs`**, one `findModulePair` try per discovered rimecms-dependent package | ✅ fixed, untested (see below) |
| consumer-app | `rimecms` (`import { cache } from 'rimecms'`) | n/a | `src/lib/...` | n/a | not a `$rime/` specifier — the lib's entry point does the split internally | ✅ |
| consumer-app | `$rime/core/plugins/cache` | rime | `src/lib/...` | n/a | walk up → consumer's own root → fails → falls back to `nativeLibDir` → rime's `dist` | ✅ accidental |
| consumer-app | `$rime/whatever` | consumer-app | `src/lib/...` | `src/lib` | walk up → consumer's own root (primary) | ✅ |
| any | `$rime/config` / `$rime/schema` | n/a | any | n/a | special-cased before the general rule | ✅ |

"flattened" = Vite's optimizer serving a prebundled copy instead of the real file, changing what
path the resolver's `importer` argument reports. Happened for `rimecms` (large, real CJS
transitive deps). Never observed for the plugin/field test packages — small, pure-ESM, optimizer
left them alone — so that row is untested, not fixed.

The 7th row (consumer-app misuse) is worth flagging separately: it *works*, but only because
the fallback can't distinguish "a lib resolving its own split" from "a consumer reaching into a
lib's private namespace." Nothing currently rejects the second — candidate for a `console.warn`
or hard error later.

## Two plugins, same bare name — no collision

`@bienbien/rime-consumer-plugin` and `@bienbien/rime-consumer-field` both use a `$rime/<short-name>`
bare name for their own split. The *root* is baked into the resolved virtual module id itself,
not just the name, so Vite's module graph (which caches purely by id) never confuses them:

```ts
return resolvedVModule(`${resolveLibRoot(importer)}${ROOT_SEP}${id}`);
// plugin's "$rime/plugin" → \0.../rime-consumer-plugin/dist\x01$rime/plugin
// field's  "$rime/field"  → \0.../rime-consumer-field/dist\x01$rime/field
```

## The fix — row 3 (`rimecms` flattened) and row 5 (a plugin flattened)

Row 3's fix: two extra static roots to try, computed once at server startup from information
that's never a runtime importer, so flattening can't touch them:

```ts
const consumerLibDir = path.resolve(process.cwd(), 'src/lib');
const nativeLibDir = isInstalledDependency(import.meta.url)
  ? findDistRoot(path.dirname(fileURLToPath(import.meta.url))) // this plugin's OWN file path
  : null;
```

`import.meta.url` is this Vite plugin's *own* file — once installed,
`node_modules/rimecms/dist/core/dev/vite/index.server.js`. Walking up from there always lands
on `node_modules/rimecms/dist`, regardless of who's asking or which file the optimizer claims
is asking. Neither root is a stand-in for "whichever third-party package is currently asking",
though — that's row 5, which needed a different fix.

Row 5's fix: `findRimePluginRoots(appRoot)` (`core/dev/generate/runtime/index.server.ts`) reads
the consumer app's own `package.json` `dependencies`, and for each one whose *own*
`dependencies` list includes `rimecms`, adds that package's `dist/` as a candidate root —
recursing through the chain (a plugin depending on a field package, not just apps installing
plugins directly), never wandering into node_modules generally. Computed once at startup, same
safe zone as `nativeLibDir`/`consumerLibDir`, so it's equally immune to flattening:

```ts
const pluginLibDirs = findRimePluginRoots(process.cwd());

const hit =
  findModulePair(root, name) ??                            // importer-derived, tried first
  (nativeLibDir && findModulePair(nativeLibDir, name)) ??   // rime's own dist, static
  findModulePair(consumerLibDir, name) ??                   // consumer's src/lib, static
  pluginLibDirs.reduce<RuntimeRegistryEntry | null>(        // every discovered plugin/field root
    (found, dir) => found ?? findModulePair(dir, name),
    null
  );
```

Narrow, accepted risk: two discovered packages defining the same bare `$rime/<name>` split name
would collide here (first match wins) — only matters after every earlier lookup already failed.
Landed this session; never actually exercised against a real flattened third-party package (the
test plugin/field packages are small and pure-ESM, so the optimizer never flattens them — see
below) — needs a real dev-server run against a package with real CJS transitive deps to confirm.

**Wrong fix, tried first, reverted**: `optimizeDeps.exclude: ['rimecms']`. Stops the
flattening entirely, but also stops esbuild converting rimecms's transitive CJS deps
(better-auth, drizzle-orm) to ESM — trades one breakage for a worse one. User caught it
immediately.

**Also considered and rejected**: baking the package name directly into the specifier (e.g.
`$rime/@bienbien/rime-consumer-plugin/plugin`) — resolves by package name via node_modules
lookup, immune to flattening by construction, no scan needed. Rejected: needs every lib author
to hardcode their own published package name into their own internal `$rime/<name>` imports,
breaking the "no prefix, ever" rule this whole mechanism is built on (see "The rule" above) —
the same shape of prefix design already rejected once this session for needing "4 ways of doing
one thing."

## Two real third-party packages

`@bienbien/rime-consumer-plugin` / `rime-consumer-field`, packed and installed for real (not
fixtures), to prove the "consumer-lib, its own split" row above actually works installed, not
just in a sandbox.

```ts
// plugin: configure() must be idempotent — not guaranteed to run once
const afterUpdate = collection.$hooks?.afterUpdate || [];
if (afterUpdate.includes(recordVisit)) return collection; // guard, or duplicate-slug crash
```

```ts
// field: proves the server half really runs, not the client no-op
export const normalizeValue: FieldHook = async (value) => `server:${value.trim()}`;
```

## Folder mode: `+rime/rime.config.ts` → `rime.config.server.ts`

`.server.ts`-suffixed, matching how every other server-only file under `+rime/` is named.
`sanitizeFolder()` special-cases this one file to still produce a client copy — everything
else under `+rime/` still gets scanned/split as before.

```js
async function processTopLevelConfig(configDir, outputDir, outputFiles, splitFiles) {
  const source = fs.readFileSync(path.join(configDir, 'rime.config.server.ts'), 'utf-8');
  // client copy: AST-strip $-content, write to +rime.generated/rime.config.ts
  // server copy: rewrite nested imports to .server.js, write to +rime.generated/rime.config.server.ts
}
```

## Schema location, centralized

A standalone config mode was tried and reverted later this session (back to folder-mode-only —
see `docs/plans/session-summary.md`), which briefly made this path mode-aware. What stands now:
one unconditional location, and one shared helper instead of hardcoding it at each call site
(`write.server.ts`, `ensure.server.ts`, the `$rime/schema` loader all call this instead of
building the path themselves):

```ts
// core/dev/constants.ts
export function schemaPath(root: string = process.cwd()): string {
  return path.resolve(root, 'src/lib', OUTPUT_DIR, 'schema.server.ts');
}
```

Adapter itself needs no change — it already goes through `import('$rime/schema')`, never a
hardcoded path.

## `local-pack-test.sh`: mandatory, both npm and pnpm, real DB check

```bash
[[ -n "$PLUGIN_PACKAGE" ]] || { echo "--plugin-package is required"; exit 1; }
```

`<spec>` → straight to `npm install "$spec"` / `pnpm add "$spec"` — tarball path or registry
spec, same flag. Runs in both npm and pnpm sections now (was npm-only).

```bash
# old check: only proved generation started
grep -q "Schema: generated" dev-plugins.log

# new: proves the migration actually landed in the real database
sqlite3 db/consumer.sqlite \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='plugin_visits';"
```

## False alarm: DB check failure was a test-script bug, not a migration bug

The `sqlite3` DB check did fail, with what looked like a real migration bug — `drizzle-kit
generate`'s output selecting a column from the *old* table shape, before the plugin added it:

```sql
INSERT INTO __new_pages (..., "consumer_plugin_note")
  SELECT ..., "consumer_plugin_note" FROM pages;  -- old `pages` never had this column
```

Actual root cause: `local-pack-test.sh` ran `rime init -n consumer-app-test`, which templates
`drizzle.config.ts` pointing at `./db/consumer-app-test.sqlite`
([templates.ts](src/lib/core/dev/cli/init/templates.ts)'s `drizzleConfig(name)`). The script
then overwrites `rime.config.server.ts` with the `tests/consumer` fixture, which hardcodes
`adapterSqlite('consumer.sqlite')` — a different file, never reconciled with
`drizzle.config.ts`. drizzle-kit was migrating a file the running app never touched; repeated
runs left it in an inconsistent half-migrated state that looked exactly like a real bug.

Fixed by changing `local-pack-test.sh`'s `APP_NAME` to `"consumer"` so the two names match.
`write.server.ts` needed no change — it's back to `generate` + `migrate` (an earlier `push`
swap, tried while this was misdiagnosed, has been reverted). See `project_drizzle_migrate_bug`
memory. Not yet re-run through `local-pack-test.sh` to confirm end to end.
