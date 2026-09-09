# Decoupling rime

The adapter should not know what a feature is. Neither should core. This document is the state of
that work, a fresh audit of where it actually stands, and the stages left — each with the
implementation written out rather than described.

**Scope note:** `src/lib/panel/` is out of scope throughout. The panel is a consumer of core like
any other; core letting go of the panel is a separate piece of work and nothing below depends on
it.

> **Read `CONTRIBUTING.md` first** if you are picking this up cold. It has the gates, the traps
> that cost a round each, and the verification loop. Every number in this document is a grep you
> can re-run — the greps are the contract, not the numbers.

---

## 1. State of the branch

Branch: `claude/cold-start-commit-9-b0f03u`.

### 1.1 Landed

The adapter no longer imports any individual feature, and no longer reads any feature's config
member. What got it there, newest first:

| commit     | what                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `df71014f` | **§4.3** — `adapter.table(slug)`; `AuthAdapter` collapses to `betterAuthAdapter`                                                                 |
| `74619ab2` | **§4.3** — auth's three ordinary reads become `prototype(slug).findMany`                                                                         |
| `a7b5bed6` | **§4.2** — `FeatureDefinition.tables` / `.columns`; the auth templates delete                                                                    |
| `2428e5aa` | **§4.1** — `transform.doc` becomes `transform.rows`; `buildDocument` is core's half                                                              |
| `8d021608` | `versionsTable` → `contentTable`, `isPanel` → `withRowMeta`, `templateDirectories` deleted — **verified locally, e2e green**                     |
| `99aea980` | the row/document merge is the adapter's, naming it is the feature's — `mergeContentRow` emits `contentId`, `versions` adds `versionId` in a hook |
| `93f98982` | `readWhere` reverted; `nested` and relation defaults use `findMany({ select: ['id'] })`                                                          |
| `4b9db413` | **bug**: a shadowed prototype could not sort by its base-row columns                                                                             |
| `2ac83daa` | `readWhere`/`updateWhere`; `childrenIds`, `existingIds`, `updateDocumentUrl`, `updateRecord` leave the contract                                  |
| `1356bef5` | upload's `_path` block leaves `insertPrototype`                                                                                                  |
| `aebef15d` | the adapter's last three `config.versions` reads                                                                                                 |
| `e921425c` | the last two `features/versions/naming` imports in core                                                                                          |
| `14fb6d2a` | `contentOwnerSlug` gone; the owning slug comes off `PrototypeHandle.shadow`                                                                      |
| `43757e1e` | `versionOperation` leaves core's vocabulary                                                                                                      |
| `76f308a2` | `getOriginalDocument` stops decoding the versions enum; core declares `ReadIntent`                                                               |
| `dc6b2160` | `bun run rime:pipeline` renders the resolved pipeline into `docs/pipeline-map.md`                                                                |
| `9c66566a` | core owns the default content owner; `handleNewVersion` moves onto the feature                                                                   |
| `1ec2dfca` | `updateWhere`, and the publish demotion becomes a versions hook                                                                                  |
| `5dac93c0` | the write plan is built above the adapter                                                                                                        |
| `a89a72c9` | the read selector comes from the caller as a filter                                                                                              |
| `25a78cdc` | a shadow is recognised by its table, not a config member                                                                                         |
| `7c7b771a` | registration carries the shadow declaration                                                                                                      |

The seams that came out of it, all on `FeatureDefinition`:

```ts
// core/features/define.ts — what a feature may contribute
augment?:    (config) => config              // fields, defaults, normalisation
configure?:  (config) => config              // whole-config steps, e.g. deriving a collection
validate?:   (config) => string[]            // what this feature requires of a config
blank?:      (doc, config) => doc            // what a blank document carries
seed?:       (doc, config) => doc            // what a *bootstrapped* first document carries
shadow?:     (config) => ShadowDeclaration   // a second table holding this config's content
tables?:     (config) => TableDeclaration[]  // storage the feature owns, asked of the whole config
columns?:    (config) => ColumnDeclaration[] // storage-only columns on a prototype that enables it
writePlan?:  (plan, { config, context }) => plan   // which rows an update touches
readQuery?:  ({ config, params, intent }) => OperationQuery | undefined  // which content row a read means
hooks?:      FeatureHooks                    // document hooks, ordered by marks
handler?:    Handle                          // a SvelteKit handle
```

### 1.2 `8d021608` — verified

The e2e suites ran green locally, which is what §4.0 was waiting for. The files it touched:

```
   src/lib/adapter-sqlite/auth.server.ts
   src/lib/adapter-sqlite/blocks.server.ts
   src/lib/adapter-sqlite/generate-schema/index.server.ts
   src/lib/adapter-sqlite/generate-schema/root.server.ts
   src/lib/adapter-sqlite/generate-schema/templates.server.ts
   src/lib/adapter-sqlite/naming.server.ts
   src/lib/adapter-sqlite/orderBy.server.ts
   src/lib/adapter-sqlite/prototype.server.ts
   src/lib/adapter-sqlite/transform.server.ts
   src/lib/adapter-sqlite/util.server.ts
   src/lib/adapter-sqlite/where.server.ts
   src/lib/core/adapter.ts
   src/lib/core/pipeline/run.server.ts
```

Three things in there:

1. **`versionsTable` → `contentTable`** (and `versionsLocalesTable` → `contentLocalesTable`) in
   `prototype.server.ts`. 23 identifier hits. Pure rename.
2. **`isPanel` is gone.** `transform.doc` was testing `event.params.panel !== undefined` to decide
   whether to keep `position`/`path`/`ownerId`/`locale` on child rows. It takes `withRowMeta` now
   and `readDocument` passes it.
3. **`templateDirectories` deleted** — dead code with no caller, and its `withDirectoriesSuffix`
   import was the last `upload` reference in the adapter.

Also `panelUsersTable` → `usersTable` in `auth.server.ts`.

Plus a comment sweep so the adapter stops _reasoning_ in feature terms.

### 1.3 Left

§4.4 onward, and none of it is large: the **insert plan**, four **feature words in core**, and
**upload's directories** (deferred out of §4.2, and half of §4.6).

---

## 2. The audit

Case-insensitive, every feature name, across `src/lib/adapter-sqlite`:

```bash
cd src/lib/adapter-sqlite
for f in versions upload auth nested url title thumbnail metas cors panel draft directories; do
  echo "$(grep -rin "$f" --include=*.ts . | wc -l)  $f"
done | sort -rn
```

| count | name          | verdict                                                                  |
| ----: | ------------- | ------------------------------------------------------------------------ |
|    71 | `auth`        | **real**, and 44 of it is `auth.server.ts` — §4.3                        |
|    22 | `nested`      | false positive — "nested object", "nested path", "nested AND conditions" |
|    18 | `title`       | false positive — `text('title')` in doc-comment examples                 |
|     1 | `url`         | "url params" in a comment about comma-separated values                   |
|     1 | `directories` | a comment naming the three templates `templateDeclaredTable` replaced    |
|     0 | the rest      | clean                                                                    |

Was 98. §4.2 took the schema generator's 46 down to 5, all of them comments recording what was
deleted. What is left breaks down as:

```
  44  auth.server.ts                     the AuthAdapter facade — §4.3
   5  where.server.ts                    false positive: `attributes.author.name` examples
   5  generate-schema/templates.server.ts  comments naming the deleted templates
   4  naming.server.ts                   the `declaredTableProperty` doc comment
   3  index.server.ts                    wiring the facade
   2  generate-schema/{root,index}.server.ts  comments recording what `hasAuth` was
```

`versions` and `panel` were at 1 each — a `docs/` filename in a pointer comment, and the comment
recording what `withRowMeta` replaced. §4.1 rewrote both files and neither word came back. **Auth
is now the only real hit in the whole database layer.**

The 98 `auth` hits break down as:

```
  44  auth.server.ts                     the AuthAdapter facade
  30  generate-schema/templates.server.ts  templateAuth (4 tables) + templateHasAuth
   9  generate-schema/index.server.ts    authConfig(), hasAuth, HAS_API_KEY
   7  generate-schema/root.server.ts     hasAuth → templateHasAuth
   5  where.server.ts                    false positive: `attributes.author.name` examples
   3  index.server.ts                    wiring the facade
```

Two hardcoded slugs, which is the sharpest tell in the whole audit:

```ts
// adapter-sqlite/auth.server.ts
const usersTable = getTable('staff');          // :37
if (slug === 'staff') { … }                    // :113
isStaff: slug === 'staff'                      // :123

// adapter-sqlite/generate-schema/templates.server.ts
${slug === 'staff' ? `isSuperAdmin: integer('is_super_admin', …),` : ''}   // :105
```

The database layer knows a collection called `staff` exists and that it is special.

### 2.1 Core's remaining feature words

```bash
grep -rn "core/features/" src/lib/core --include=*.ts \
  | grep -v "^src/lib/core/features/" | grep -v spec
```

Legitimate — a prototype listing the features that extend it, and the registry contract:

```
prototype/{collection,area}/definition.ts   features: [auth, panel, upload, …]
config/{validate,build,context}.server.ts   features/registry.js  (shadowOf, validateWithFeatures…)
prototype/api.server.ts                     features/registry.js  (blankWithFeatures, readQueryOf)
handlers/index.ts                           features/registry.js  (featureHandlers)
```

Leaks:

```
core/handlers/auth.server.ts                      → features/auth/constant.server.js  (BETTER_AUTH_ROLES)
core/prototype/collection/hooks/merge-with-blank  → features/upload/util/config.js    (isUploadConfig)
core/constants.ts                                 VERSIONS_STATUS, UPLOAD_PATH
core/dev/codegen/routes/common.server.ts          two hardcoded `…/versions` panel routes
```

### 2.2 Feature-to-feature

```
features/upload/naming.ts                    → features/versions/naming.js   (withoutVersionsSuffix)
features/versions/hooks/handle-new-version   → features/upload/util/converter.server.js (filePathToFile)
```

Both are real. The first is why `withDirectoriesSuffix('$pages__versions')` resolves to
`$pagesDirectories` — upload strips a suffix it should not know about.

---

## 3. The rule this is all trying to satisfy

From `docs/architecture-target.md`:

> Each part of the system is responsible for itself. A prototype does not know what a feature is.

Three tests that have actually caught things, in order of how often they fire:

1. **A method named after a feature's question.** `childrenIds` was `nested`'s question. `updateDocumentUrl` was `url`'s. If you can only explain what a method is for by naming a feature, it is that feature's method.
2. **A feature word in a _return value_.** `mergeRawDocumentWithVersion` emitted `versionId`. Renaming it moves the tell, not the coupling — the caller still receives a feature's vocabulary.
3. **A prototype listing a feature's hook.** That means _core is missing a default_. The fix is never "find a timing that means always"; it is core stating the default and the feature overriding it.

And the counter-test, which matters just as much: `blocks`, `tree` and `relations` are facades for
**storage shapes**, not features. Collapsing those into primitives would make core rebuild the same
three write plans by hand. Leave them.

---

## 4. The stages

Each is shippable on its own and gate-able on its own. Annexes carry the detail:
`decoupling-transform.md`, `decoupling-tables.md`, `decoupling-auth.md`.

### 4.0 — Verify what `8d021608` landed — **done**

The commit's one behavioural change was `withRowMeta`: the same `event.params.panel` expression,
moved one layer up out of the adapter. It ran green through the e2e suites locally, which is the
half the cloud container could not do — its Chromium and Playwright's disagree, so nothing in a
container run reaches the panel, and the panel is the only consumer of that flag.

The reported `tests/basic/pages.test.ts:9 › Login form › should login successfully` failure was a
container artefact, not a signal. It passes locally.

### 4.1 — Split `transform` — **done**

`adapter-sqlite/transform.server.ts` was ~300 lines and about half of it had nothing to do with a
database. It is 169 now, and the half that left is 129 lines of
`core/pipeline/build-document.server.ts`.

**Full detail: `docs/decoupling-transform.md`.**

```ts
// core/adapter.ts — the adapter's half
export interface TransformAdapter {
  rows(args: { doc: RawDoc; slug: PrototypeSlug; locale?: string }): Promise<DocumentRows>;
}

export type DocumentRows = {
  /** Flat, keyed by document path, locales branch merged, child-table keys removed. */
  base: Dic;
  blocks: Dic[];
  tree: Dic[];
  /** `relationTo` and `documentId` resolved off whichever foreign key column was set. */
  relations: Dic[];
};
```

```ts
// core/pipeline/build-document.server.ts — core's half
export const buildDocument = async <T extends GenericDoc>(
  rows: DocumentRows,
  args: { config; event; locale?; depth?; withBlank?; withRowMeta? }
): Promise<T> => { … };
```

What crossed the line, and why each was never the adapter's:

| moved                       | it needed                                              |
| --------------------------- | ------------------------------------------------------ |
| the blank merge             | `rime.collection(slug).blank()` — a fold over features |
| the `withRowMeta` strip     | who is asking                                          |
| relation assembly and depth | `rime.collection(relationTo).findById()`               |
| the `editedBy` strip        | `event.locals.user`                                    |
| the orphan warnings         | `config.slug`                                          |

Two things the adapter stopped doing, both of which were the inversion that hid this:

- **It no longer takes `event`.** `rows()` takes a doc, a slug and a locale.
- **It no longer reaches up into the local API.** Both calls it made — `blank()` and the depth
  walk's `findById` — were the database layer calling core.

Three decisions the annex left open:

1. **`base` comes back flat.** The annex had core run `transformDatabaseColumnsToPaths(flatten(…))`,
   which is core applying the adapter's own column-naming rule (`__` separates path segments).
   The adapter does it and hands back flat, path-keyed columns; core unflattens once, at the end.
2. **Child-table keys are stripped up front, not at the end.** They used to ride through every
   step as `pages__$blocks_hero.0.id` and get removed by name after the blank merge.
3. **The locale and orphan checks moved above the depth walk**, so a relation that is about to be
   dropped no longer costs a `findById` first. Same output, one less read.

This is what earns a **transform hook timing** — `versions`' `exposeVersionId`, `upload`'s
`populateSizes`, core's `setDocumentType` and `setDocumentLocale` are all mappings living in
`beforeRead`. Four inhabitants on day one. Not yet built: a seam with one inhabitant is a
preference, and this repo has been bitten by building seams early.

Gates, all re-measured on the same fixture against the change stashed:

```bash
bun run check                # 13 — identical list stashed and unstashed, so fixture, not regression
bunx vitest run              # 165
bunx eslint src/lib          # 20
bun run check:circular-deps  # 3, same list
bun run test                 # green, every fixture
```

The e2e suites are the gate that matters here: the transform runs on every document of every read,
so `test:fields` (blocks and tree in every arrangement), `test:multilang` (the locales branch) and
`test:versions-multilang` (the locales branch on a shadow) each cover a pile that changed hands.

### 4.2 — `FeatureDefinition.tables` — **done**

Two members, not one. `tables` is storage the feature owns and no prototype declares; `columns` is
storage-only columns it puts on a prototype that enables it — separate from `augment`, which adds
_fields_, things a document has that a form writes and the pipeline validates.

**Full detail: `docs/decoupling-tables.md`.**

```ts
// core/features/define.ts
tables?: (config) => TableDeclaration[];   // whole-config, folded ungated
columns?: (config) => ColumnDeclaration[]; // per-prototype, folded gated by `enabled`
```

```ts
// core/features/tables.ts — six column types, a slug-space foreign key, no drizzle and no SQL
export type ColumnType =
  'text' | 'integer' | 'real' | 'boolean' | 'timestamp' | 'timestampMs' | 'json';
```

**The `enabled` question the annex flagged, decided.** `tables` folds **ungated**: `enabled` is
written against a _prototype_ config and `tables` is asked of the whole one, so gating there tests
the wrong object and silently emits nothing. Auth returns `[]` when no collection declares `auth` —
`enabled`'s own test, made at the scope the question has. `columns` _is_ per-prototype, so it folds
gated, like `blankWithFeatures`.

What deleted:

```
templateAuth        4 tables as a string constant, emitted unconditionally
templateAPIKey      a fifth, behind `authConfig(prototype)?.type === 'apiKey'`
HAS_API_KEY         the sniff itself
templateHasAuth     a column, plus `slug === 'staff'`
authConfig()        the config-member read
hasAuth             a flag threaded through buildRootTable's parameter list
```

One `templateDeclaredTable` and one `templateDeclaredColumn` replace all of it, and neither names
anything.

**One new naming rule, and it is the only place a declared table differs from a prototype's.** A
prototype's slug is authored and its table name derived, so the two are one string and
`toSqlTableName` is the identity that says so. A declared table is the other way round: the feature
chose the identifier and reaches its rows by it, so the identifier is fixed and the SQL name is
derived. `declaredTableProperty` is that rule — `$authUsers` exports as `authUsers` and lives in
`auth_users`. **No table is renamed**, which is what keeps this a zero-migration change.

Gates, and this is the stage where the schema diff is the whole point:

```bash
# per fixture: capture, change, regenerate, compare
rm node_modules/.rime/config.txt
bun ./src/lib/core/dev/cli/index.ts generate --force
```

Codegen runs headless — no `vite dev` needed, which is what makes a golden capture cheap. Captured
before and after on `basic` (auth + api keys) and `versions` (auth + shadows): **same tables, same
columns, same column order**. The only textual difference is `.notNull().references()` where the
template wrote `.references().notNull()`, which drizzle resolves identically — and
`drizzle-kit generate` says `No schema changes, nothing to migrate` on both.

`bun run check` is **0 on `versions`**, the baseline `CONTRIBUTING.md` states.

Two things §4.2 was expected to carry that it does not, deliberately:

- **`adapter.assertTable`** (annex §4.3). Boot surface with nothing to catch yet: `configure`
  derives the staff collection for every config, so the auth tables are always emitted. It lands
  with the first feature whose tables are genuinely conditional.
- **upload's directories** (annex §1.4, §3.2). A separate change with its own schema diff, and it
  is half of §4.6 — the `withoutVersionsSuffix` import goes with it.

### 4.3 — The auth facade — **done**

Seven members down to one, in two commits.

**Full detail: `docs/decoupling-auth.md`.**

```ts
// core/adapter.ts — all that is left
export interface AuthAdapter {
  /** The Better-auth database adapter. Opaque to core, which only hands it to Better-auth. */
  betterAuthAdapter: unknown;
}
```

**`74619ab2` — the three ordinary reads.** `isSuperAdmin`, `getBetterAuthUserId` and
`getUserAttributes` were each `select … from <a prototype's table> where <a column> = ?`, which is
`prototype(slug).findMany`. They looked like adapter work because all three named a collection
called `staff`. They are `features/auth/user.server.ts` now, and the slug is `STAFF_SLUG` in the
feature that derives that collection. The `where` builder resolves against the table's real
columns, so `authUserId` and `isSuperAdmin` — declared columns since §4.2, not fields — needed no
special case.

**`df71014f` — the three on Better-auth's own tables**, and one new handle:

```ts
// core/adapter.ts
table(slug: string): TableHandle;

export interface TableHandle {
  find(args?: { where?: Dic; select?: string[]; limit?: number }): Promise<Dic[]>;
  update(args: { where: Dic; data: Dic }): Promise<void>;
  delete(args: { where: Dic }): Promise<void>;
}
```

Three verbs and a flat column-to-value filter, because a declared table has no config behind it:
nothing to resolve a path against, no locales branch, no children, no blank to merge. That is the
whole difference from `PrototypeHandle`, and the reason this stays small. `update` and `delete`
refuse an empty `where` — drizzle's `and()` of nothing is `undefined`, which renders as a statement
with no `WHERE` clause.

**The annex's open question, answered: Better-auth's admin API cannot replace those three.**
`listUsers`, `setRole` and `removeUser` all sit behind `adminMiddleware`, and every caller runs
where no admin session exists:

| call              | when                                      | why the admin API refuses    |
| ----------------- | ----------------------------------------- | ---------------------------- |
| `hasAuthUser`     | gates the init route — no user exists yet | no session to authorize      |
| `setAuthUserRole` | promotes the very first signup to admin   | no admin exists to authorize |
| `deleteAuthUser`  | rolls back a failed signup                | `YOU_CANNOT_REMOVE_YOURSELF` |

`better-auth/hooks.server.ts` already carried a comment saying so — "would be cleaner to do it with
the admin plugin, not possible at the moment". It is now written down with the reason.

**Both commits are gated by specs that assert the call, not the result**, because two of these fail
_open_. A wrong `isSuperAdmin` query that matches nothing reads as "not the super-admin" and one
that matches too much reads as "yes"; neither is visible in a passing suite. `deleteAuthUser` is
the same shape — it deletes sessions before the user they belong to, and reversed, the row is gone
but the session that authenticates as it is not. So `user.spec.ts` pins the slug, the filter and
the projection, and `better-auth-tables.spec.ts` pins the order. Proved by breaking it: dropping
the `isSuperAdmin` condition fails one test.

### 4.4 — The insert plan

The last `config.versions` read on any write path, and the last place `insertPrototype` splits data
for itself.

```ts
// core/adapter.ts — insert takes a plan, like update already does
insert(args: {
  data: Dic;
  content?: { data: Dic };     // no id — the adapter makes the row and answers with it
  locale?: string;
}): Promise<{ id: string; contentId: string }>;
```

The update plan cannot be reused verbatim, because an insert has no row to name yet. `WritePlan`
gains an optional id:

```ts
export type WritePlan = {
  data: Dic;
  /** `id` absent on an insert, where the adapter creates the row and answers with its id. */
  content?: { id?: string; data: Dic };
};
```

`create.ts` folds `writePlanWithFeatures` before calling `insert`, exactly as `runUpdate` does at
step 3.5. `ensurePrototypeExists` already takes a seeded blank (`FeatureDefinition.seed`), so it
needs nothing further.

### 4.5 — Core's feature words

Four small ones, each independent:

```ts
// core/handlers/auth.server.ts — imports BETTER_AUTH_ROLES from the auth feature
// → the feature's `handler` already exists; this belongs behind it.

// core/prototype/collection/hooks/merge-with-blank.server.ts — imports isUploadConfig
// → what it actually needs is "does this field come from a file", which is a field question.

// core/constants.ts — VERSIONS_STATUS, UPLOAD_PATH
// → move each into its feature; they are only shared because they were declared centrally.

// core/dev/codegen/routes/common.server.ts — two hardcoded panel `…/versions` routes
// → a feature declaring routes is `FeatureDefinition.routes`, sibling to `handler`.
```

### 4.6 — Feature to feature

```ts
// features/upload/naming.ts
import { withoutVersionsSuffix } from '../versions/naming.js';

export const withDirectoriesSuffix = (slug: string) =>
  `${DERIVED}${withoutVersionsSuffix(slug)}${MARKER}` as CollectionSlug;
```

Upload strips a suffix it should not know about, so that a shadow's directories resolve to its
parent's. After §4.2 the directories table is a declaration made once per _config_, not a name
derived per slug, and the import goes with it.

The other direction — `handleNewVersion` importing upload's `filePathToFile` to carry a file onto a
new version — is a genuine cross-feature dependency and the honest fix is a feature declaring what
a new content row inherits. Lowest priority; note it, do not force it.

---

## 5. Order, and why

```
4.0  verify 8d021608              ← done
4.1  split transform              ← done
4.2  FeatureDefinition.tables     ← done (minus upload's directories)
4.3  the auth facade              ← done
4.4  the insert plan              ← independent, small — next
4.5  core's feature words         ← independent, four small commits
4.6  feature to feature           ← unblocked; upload's directories is the first half
```

4.4 and 4.5 are the cheap ones and can be done any time something bigger is blocked.

---

## 6. What "done" looks like

```bash
# every feature name, case-insensitive, in the database layer
cd src/lib/adapter-sqlite
for f in versions upload auth nested url title thumbnail metas cors panel directories; do
  echo "$(grep -rin "$f" --include=*.ts . | wc -l)  $f"
done | sort -rn
```

Zero, apart from words that are also English ("nested object", "url params"), doc-comment examples,
and comments recording what a stage deleted. Today that is `auth 71`, of which 44 is
`auth.server.ts` — §4.3 is the last of it.

```bash
# core naming a feature, other than a prototype listing its own
grep -rn "core/features/" src/lib/core --include=*.ts | grep -v "^src/lib/core/features/"
```

Only `features/registry.js` and the two prototype definitions' feature lists.

```bash
# a feature naming another
grep -rn "core/features/" src/lib/core/features --include=*.ts \
  | grep -vE "^src/lib/core/features/([a-z-]+)/.*features/\1/"
```

Empty, or one entry with a written reason.

---

## Appendix A — the adapter's vocabulary

Four words, and every table name in the generated schema is one of them. This is what
`adapter-sqlite/naming.server.ts` implements; `TableName` is a branded type, so a slug reaching a
table-name parameter is a build error rather than a runtime miss.

```
pages__versions__$blocks_hero__$$locales
└base┘  └shadow┘  └───child───┘ └branch┘
```

**base** — `snakeCase(slug)`. The prototype's own table.

```
pages
```

**shadow** — `{owner}__{shadow}`. `__` reads "shadow of". A shadow only ever shadows a base, and
carries a relation back to its owner. A prototype has at most one.

```
pages__versions
```

**child** — `{owner}__${kind}` (`__$` reads "child of"). A table junctioned to a base or a shadow,
never to another child. Created because a field needs rows rather than a column.

```
pages__$blocks_hero      # a blocks field
pages__$relations        # any relation field in the tree
pages__$tree             # a tree field
```

**branch** — `{owner}__$${branch}` (`__$$` reads "branch of"). The owner split in two, the same
columns on a second axis.

```
pages__$$locales
pages__versions__$$locales
pages__$blocks_hero__$$locales
pages__versions__$blocks_hero__$$locales
```

`owner = shadow ?? base` is the load-bearing line: everything a base can own, a shadow owns
instead when one exists. In code that is `ConfigContext.shadowSlugOf(slug) ?? slug`, and no caller
of it names the feature that declared the shadow.

### Naming, across the three surfaces

A slug is authored `camelCase`. A slug **derived by a feature** takes a `$` prefix, which is
stripped everywhere but the slug itself.

|           | process               | gives                 |
| --------- | --------------------- | --------------------- |
| **slug**  | —                     | `$someSlug__versions` |
| **url**   | `kebab(slug minus $)` | `some-slug--versions` |
| **table** | `snake(slug minus $)` | `some_slug__versions` |

| slug                  | url                   | table                 |
| --------------------- | --------------------- | --------------------- |
| `camelCase`           | `camel-case`          | `camel_case`          |
| `$mediasDirectories`  | `medias-directories`  | `media_directories`   |
| `$someSlug__versions` | `some-slug--versions` | `some_slug__versions` |

### What the vocabulary buys

The adapter answers structural questions by table presence, never by config membership:

```ts
// not `config.versions.enabled`
const hasShadow = shadowTableName(slug) in tables;

// not `config.upload` — a child table exists or it does not
const blocksTables = childTableNames(owner, 'blocks', tables);
```

A feature that adds a table adds a word to the schema, and the adapter reads the word. That is the
whole contract — everything in §4 is an application of it.
