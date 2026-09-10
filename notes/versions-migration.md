# Migrating data when a collection or area opts in or out of `versions`

## The problem

A collection's content lives on one table until it is versioned, and on two after.

```
versions off   pages                    id, content columns, createdAt, updatedAt
               pages__$$locales         the localized content columns
               pages__$blocks_hero      ownerId -> pages.id
               pages__$relations        ownerId -> pages.id

versions on    pages                    id, ._root() columns, createdAt, updatedAt
               pages__versions          content columns, status, ownerId -> pages.id
               pages__versions__$$locales
               pages__versions__$blocks_hero   ownerId -> pages__versions.id
               pages__versions__$relations     ownerId -> pages__versions.id
```

Flipping `versions` in the config regenerates the schema, and `drizzle-kit generate`
sees eight tables disappear and nine appear. It has no way to know the new tables hold
the old tables' rows, so the migration it writes destroys every document.

This is the migration `drizzle-kit generate` produced for `versions: { draft: true }` on
a localized `pages`, answering "create" to every prompt:

```sql
CREATE TABLE `pages__versions` (...);
CREATE TABLE `pages__versions__$$locales` (...);
CREATE TABLE `pages__versions__$blocks_image` (...);
-- six more
DROP TABLE `pages__$$locales`;
DROP TABLE `pages__$blocks_image`;
-- six more
ALTER TABLE `pages` DROP COLUMN `hero__hero_type`;
ALTER TABLE `pages` DROP COLUMN `attributes__is_home`;
-- four more
```

Nine empty tables, and every row of content gone.

## What drizzle-kit 1.0 actually does

Three findings, each checked against `drizzle-kit@1.0.0-rc.4` on this repo.

**1. Kit asks rather than guessing.** When a table appears and another disappears in the
same diff, kit stops and asks whether it is a rename or a create. With no TTY it prints
the two answers it will accept and exits with code 2:

```
missing_hints: 9 unresolved decisions

1. Rename or create  —  table  public.pages__versions
   Add to --hints:
     { "type": "rename", "kind": "table", "from": ["<schema>", "<old_name>"], "to": ["public", "pages__versions"] }
     OR
     { "type": "create", "kind": "table", "entity": ["public", "pages__versions"] }
```

`rime dev` spawns kit with `stdio: 'inherit'`, so today this either prompts in the middle
of a dev server or fails the run.

**2. `--hints` answers them without a prompt.** It takes a JSON array of the objects above.
Hints naming tables that are not in the diff are ignored — passing a hint set that is a
superset of the questions kit will ask is safe.

**3. Answering "rename" preserves the rows.** With rename hints for the eight children,
kit emits `ALTER TABLE ... RENAME TO` and then rebuilds each table to repoint its foreign
key, carrying rows across with `INSERT ... SELECT`:

```sql
ALTER TABLE `pages__$$locales` RENAME TO `pages__versions__$$locales`;
PRAGMA foreign_keys=OFF;
CREATE TABLE `__new_pages__versions__$$locales` (... REFERENCES `pages__versions`(`id`) ...);
INSERT INTO `__new_pages__versions__$$locales`(...) SELECT ... FROM `pages__versions__$$locales`;
DROP TABLE `pages__versions__$$locales`;
ALTER TABLE `__new_pages__versions__$$locales` RENAME TO `pages__versions__$$locales`;
PRAGMA foreign_keys=ON;
```

A `__$$locales` branch whose owner was itself renamed is only renamed, not rebuilt —
SQLite rewrites the foreign key reference for it.

So renames handle every table except two things kit cannot know:

- `pages__versions` has no counterpart. Its rows have to be built from `pages`.
- The renamed children still carry `ownerId` values pointing at `pages.id`. They have to
  be remapped to the new version row ids.

## How a hand-written migration coexists with drizzle

`drizzle-kit generate --custom --name=<name>` writes a migration folder holding an empty
`migration.sql` and a `snapshot.json` that is a copy of the current state. The snapshot
is what the next `generate` diffs against, and it is built from the schema file, never
from the SQL body. Two consequences:

- DML in a custom migration is invisible to drizzle and safe.
- DDL in a custom migration desynchronizes the snapshot: the next `generate` will emit
  the same DDL again.

Editing the SQL body of a *generated* migration is safe for the same reason. Confirmed:
after injecting the data-moving SQL into the generated file and running `migrate`, the
next `drizzle-kit generate` reported `No schema changes, nothing to migrate`.

Two custom migrations cannot bracket the generated one usefully. Migrations run in folder
name order, so a custom file runs entirely before or entirely after — and the data has to
move *while both shapes exist*, which is only true inside the generated migration.

**The data-moving SQL is injected into the generated `migration.sql`, between the
statements that build the new shape and the statements that destroy the old one.**

## Where the seam is

Kit orders its statements the same way both directions, which puts a single splice point
in each.

Opt-in — inject before the first `ALTER TABLE <base> DROP COLUMN`:

```
1  CREATE TABLE pages__versions
2  ALTER TABLE ... RENAME TO ...          (8 children)
3  table rebuilds to repoint foreign keys
   << inject here >>
4  ALTER TABLE pages DROP COLUMN ...      (the base's content columns)
```

Opt-out — inject before `DROP TABLE <base>__versions`:

```
1  ALTER TABLE ... RENAME TO ...          (8 children, back to base names)
2  ALTER TABLE pages ADD <column>         (the base regains its content columns)
3  table rebuilds to repoint foreign keys
   << inject here >>
4  DROP TABLE pages__versions
```

Split the generated file on `--> statement-breakpoint`, find the index of the first
statement matching the anchor for that base table, splice. Throw if the anchor is absent
rather than writing a migration that runs the data move at the wrong point.

## Detecting the transition

The previous shape is in the newest `db/*/snapshot.json`. Its `ddl` array holds one entry
per table with `entityType: 'tables'` and a `name`:

```ts
const previous = new Set(
  snapshot.ddl.filter((e) => e.entityType === 'tables').map((e) => e.name)
);
```

For each prototype config, compare `previous.has(versionsTableName)` against
`Boolean(config._versions)`:

```
was      is       transition
absent   versioned    opt-in
present  unversioned  opt-out
```

Nothing else needs recording. The snapshot is written by kit on every generate, is
committed alongside the migrations, and cannot drift from the database the way a cache in
`node_modules/.rime` can.

## The four scenarios

`<base>` is the base table, `<v>` is `<base>__versions`. Every table below is named by
`naming.server.ts`, so the SQL is generated from the same functions the schema is.

The tables whose `ownerId` points at the root — and therefore need remapping — are exactly:

```
<root>__$$locales
<root>__$blocks_<name>     every one, including blocks nested inside blocks
<root>__$tree_<name>       every one
<root>__$relations
```

A `__$$locales` branch of one of those points at its own owner, whose id never changes.
Those need nothing.

### 1. Opt-in, no localized content

Hints: `create` for `<v>`, `rename` for every child of `<base>`.

```sql
-- one version per document, carrying the content columns off the base row
INSERT INTO `<v>` (`id`, <content columns>, `status`, `owner_id`)
SELECT <uuid expression>, <content columns>, 'published', `id` FROM `<base>`;

-- each direct child now hangs off its document's version row
UPDATE `<v>__$blocks_hero`
SET `owner_id` = (SELECT v.`id` FROM `<v>` v WHERE v.`owner_id` = `<v>__$blocks_hero`.`owner_id`);
-- repeated per direct child table
```

`status` is written only when `versions.draft` is on — `augmentVersions` adds the column
only then. `'published'` and not `'draft'`: with drafts on, an ordinary read filters
`status = 'published'` (`versions/read-query.ts`), so a draft row would hide every
document that was visible before the flip.

`<content columns>` is every column on `<v>` except `id`, `status` and `owner_id`. It
includes `createdAt`, `updatedAt` and `editedBy`: `augmentMetas` does not mark them
`._root()`, so they are content. `generateSchemaString` puts `createdAt` and `updatedAt`
on the base table as well, so those two exist on both and the base keeps its own.
`editedBy` is dropped from the base by the same migration.

The id expression builds a v4 UUID, matching `pk()`'s `crypto.randomUUID()`:

```sql
lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4'
  || substr(lower(hex(randomblob(2))),2) || '-'
  || substr('89ab',abs(random())%4+1,1) || substr(lower(hex(randomblob(2))),2) || '-'
  || lower(hex(randomblob(6)))
```

### 2. Opt-in, with localized content

Identical, plus `<v>__$$locales` in the remap list. Its rows arrive already renamed and
rebuilt, one per locale per document, with `ownerId` still holding the base id:

```sql
UPDATE `<v>__$$locales`
SET `owner_id` = (SELECT v.`id` FROM `<v>` v WHERE v.`owner_id` = `<v>__$$locales`.`owner_id`);
```

Every locale follows the single new version, which is correct: one version holds all
locales of one revision.

### 3. Opt-out, no localized content

Hints: `rename` for every child of `<v>` back to its `<base>` name. `<v>` itself needs no
hint — it is dropped with no counterpart.

One version has to win per document. Record the winners first, because after the remap
there is no way to tell which version a child row came from.

```sql
CREATE TABLE `_rime_winner` AS
SELECT v.`owner_id` AS `base_id`, v.`id` AS `version_id`
FROM `<v>` v
WHERE v.`id` = (
  SELECT w.`id` FROM `<v>` w
  WHERE w.`owner_id` = v.`owner_id`
  ORDER BY (w.`status` = 'published') DESC, w.`updated_at` DESC, w.`id` DESC
  LIMIT 1
);
```

With `draft: false` there is no `status` column; drop that first `ORDER BY` term and the
newest row wins. `id DESC` is the tiebreak, so the result does not depend on row order.

```sql
-- the winning version's content goes back onto the base row
UPDATE `<base>` SET
  `hero__hero_type` = (SELECT v.`hero__hero_type` FROM `<v>` v
                       JOIN `_rime_winner` k ON k.`version_id` = v.`id`
                       WHERE k.`base_id` = `<base>`.`id`),
  -- one line per content column, including updated_at and edited_by
WHERE `<base>`.`id` IN (SELECT `base_id` FROM `_rime_winner`);

-- children of losing versions go, before anything is remapped
DELETE FROM `<base>__$blocks_hero` WHERE `owner_id` NOT IN (SELECT `version_id` FROM `_rime_winner`);
-- repeated per direct child table

-- then their localized branches, now orphaned
DELETE FROM `<base>__$blocks_hero__$$locales`
WHERE `owner_id` NOT IN (SELECT `id` FROM `<base>__$blocks_hero`);
-- repeated per branch

-- surviving children hang off the document again
UPDATE `<base>__$blocks_hero`
SET `owner_id` = (SELECT k.`base_id` FROM `_rime_winner` k
                  WHERE k.`version_id` = `<base>__$blocks_hero`.`owner_id`);
-- repeated per direct child table

DROP TABLE `_rime_winner`;
```

Skipping the deletes gives a document with one copy of its blocks per version it had.

`created_at` is not copied: the base row's own is the document's creation. `updated_at`
is copied, because on a versioned config that is where rime maintains it.

### 4. Opt-out, with localized content

Identical, plus `<base>__$$locales` in both the delete list and the remap list. Deleting
the losing versions' locale rows is what keeps one row per locale:

```sql
DELETE FROM `<base>__$$locales` WHERE `owner_id` NOT IN (SELECT `version_id` FROM `_rime_winner`);
UPDATE `<base>__$$locales`
SET `owner_id` = (SELECT k.`base_id` FROM `_rime_winner` k
                  WHERE k.`version_id` = `<base>__$$locales`.`owner_id`);
```

## When the version flip is not the only change

A consumer edits fields, adds a collection, flips `versions` on another, and saves once.
Everything above still holds, with two corrections that a versions-only reading gets wrong.

Checked by making all five changes in one save on `tests/multilang`: add a field to `pages`,
remove a field from `pages`, add a block to `pages`, add a `notes` collection, turn
`versions` on for `pages`.

### Kit asks about every created table, not just the versioned ones

```
missing_hints: 13 unresolved decisions

1. Rename or create  —  table  public.notes
2. Rename or create  —  table  public.notes__$$locales
3. Rename or create  —  table  public.pages__versions
...
10. Rename or create  —  table  public.pages__versions__$blocks_quote__$$locales
```

`notes` has nothing to do with versions. Kit sees eight `pages__*` tables disappear and
thirteen tables appear, and cannot rule out that any created table is a rename of any
dropped one. Answering only the versions questions still leaves kit prompting, or exiting
with code 2 under `rime generate`.

So rime answers **all** of them, by one rule:

```
a created table whose name exists in the old snapshot        rename from it
a created table whose unversioned counterpart is in the old  rename from that
anything else                                                create
```

`pages__versions__$blocks_quote` is the case that separates the rule from "rename every
child": the block is new in this save, the old snapshot has no `pages__$blocks_quote`, so
it is a create. Same for `notes`, `notes__$$locales` and `pages__versions` itself.

This makes the hint builder useful beyond this feature. A rename-or-create prompt in the
middle of a dev server is not specific to versions — any save that drops one table and
adds another raises it. Answering `create` for everything rime cannot match is what kit
did before 1.0.

### The column lists are intersections, not the new schema's columns

With the five changes above, the two tables no longer agree on their columns:

```
pages         (old)   id, created_at, updated_at, hero__hero_type, hero__intro, ...
pages__versions (new) id, hero__subtitle, hero__intro, ..., status, edited_by, owner_id
```

`hero__hero_type` is on the old base and not on the versions table — the field was
removed in the same save. `hero__subtitle` is on the versions table and was never on the
base — the field was added in the same save.

`INSERT INTO pages__versions (...) SELECT ... FROM pages` over "every column on the
versions table" reads `hero__subtitle` off `pages` and fails. Over "every column on the
old base" it writes `hero__hero_type` to a column that does not exist.

**The copy list is the intersection of the old base's columns and the new versions
table's columns**, minus `id`, `status` and `owner_id`. Old columns come from the snapshot
read before generate ran, new ones from the generated Drizzle table object. A column on
only one side is a field the same save added or removed, and dropping it from the copy is
the right answer for both: an added field has no old value, a removed field has nowhere to
go.

The same holds in the other direction for opt-out.

### The splice point survives

Kit groups its output by kind, so unrelated work does not interleave with the version
move:

```
1   CREATE TABLE notes, notes__$$locales          the new collection
2   CREATE TABLE pages__versions                  the version table
3   CREATE TABLE pages__versions__$blocks_quote   the new block
4   ALTER TABLE ... RENAME TO ...                 the eight existing children
5   table rebuilds to repoint foreign keys
    << inject here >>
6   ALTER TABLE pages DROP COLUMN ...             six columns, versions and the removed field alike
```

The anchor is still the first `ALTER TABLE pages DROP COLUMN`. `hero__hero_type` is
dropped there for a different reason than the other five, and it does not matter: by that
line the data move has already read whatever it was going to read.

Two prototypes flipping in one save get two independent splices, each anchored on its own
base table name. Find each anchor by index in the split statement list and apply the
splices from the last index backwards, so an earlier insertion does not move a later
anchor.

## Where this lands in the code

`adapter-sqlite/generate-schema/write.server.ts` already runs `generate` then `migrate`.
The transition work sits between them, in that order:

1. Read the newest `db/*/snapshot.json` **before** running generate — table names and
   column names both. After generate runs, the newest snapshot is the new one, and the
   old shape is unreadable.
2. Compare against `config` to find every prototype that changed. Usually none.
3. Build a hint for **every** table the new schema has and the old snapshot does not —
   `rename` when the old snapshot holds its unversioned counterpart, `create` otherwise —
   and pass `--hints` to `generate`. Hints for tables kit does not ask about are ignored,
   so the array does not have to predict the questions.
4. Read back the migration folder generate just wrote — the newest one — split its
   `migration.sql` on `--> statement-breakpoint`, splice the data-moving SQL in at the
   anchor, write it back.
5. Run `migrate`.

New files, one concern each:

```
generate-schema/transition/detect.server.ts    snapshot vs config -> the changed prototypes
generate-schema/transition/hints.server.ts     a prototype + direction -> the hint array
generate-schema/transition/sql.server.ts       a prototype + direction -> the statements
generate-schema/transition/inject.server.ts    statements + migration.sql -> migration.sql
```

`sql.server.ts` needs the column lists. The new side comes off the generated Drizzle
table objects with `getColumns`; the old side comes from the snapshot read in step 1. It
copies the intersection.

Say what happened, out loud. The migration rewrites files git is tracking and moves rows
the author cannot see, the same reason the `drizzle-kit up` conversion above it logs:

```
pages: versions enabled — 1 migration will move 4 rows onto pages__versions.
```

## Hazards

**Failing halfway.** The statements run one at a time. A failure between the renames and
the remap leaves children pointing at ids that no longer mean anything. Whether libsql's
migrator wraps a migration in a transaction needs checking before this ships; if it does
not, the data move should open its own.

**An existing `_rime_winner`.** A previous failed run can leave it behind and
`CREATE TABLE` will fail. Prefix the drop: `DROP TABLE IF EXISTS` first.

**Editing after applying.** `__drizzle_migrations` stores a hash per migration. Injecting
into a migration that has already been applied somewhere is a different problem from
injecting into one generate just wrote. Only ever inject before `migrate` runs.

**A production database that skipped a step.** An app that generates on a developer
machine and migrates in production ships the migration file, so the data move travels
with it. An app that runs `generate` in production against a database that is behind gets
whatever kit diffs; that is already true today and this changes nothing.

**Auth collections are already rejected.** `validateAuth` refuses `auth` together with
`versions` (`core/auth/validate.ts`), and `runCodegen` runs validation at step 2 and the
schema at step 5, so the error is raised before drizzle-kit is ever spawned. Nothing here
has to handle a versioned auth collection.

`generateSchemaString` still passes `featureColumns: authColumns(prototype)` to both the
base build and the versions build, which would put `auth_user_id` on each. Unreachable
while the guard holds; worth deleting from the versions build so it stays unreachable.

**Upload columns are content.** Only `_path` is `._root()`. On a versioned upload
collection `filename`, `mimeType` and the image size columns live per version, and opt-out
keeps the winning version's. The files on disk are untouched either way.

## What was verified, and how

On `tests/multilang` with a seeded `pages` row — two locales, one block with a localized
branch, one relation — using `drizzle-orm`/`drizzle-kit` `1.0.0-rc.4`:

| Step | Result |
|---|---|
| Generate with no hints, no TTY | Exit code 2, nine `missing_hints` decisions |
| Generate with all-`create` hints | Nine creates, eight `DROP TABLE`, six `DROP COLUMN` — every row lost |
| Generate with `rename` hints | Renames plus foreign-key rebuilds, every child row carried across |
| Inject the opt-in SQL, migrate | One version row per page, `status = 'published'`, every child remapped |
| `generate` again | `No schema changes, nothing to migrate` |
| Seed a second, newer draft version | Two versions of one page, each with its own children |
| Flip `versions` off, generate with `rename` hints | Renames, `ALTER TABLE pages ADD` ×6, `DROP TABLE pages__versions` last |
| Inject the opt-out SQL, migrate | Published version won over the newer draft; the draft's children deleted; base row byte-identical to before the opt-in |
| `generate` again | `No schema changes, nothing to migrate` |
| Hints naming tables not in the diff | Ignored |
| `generate --custom` | Folder holds an empty `migration.sql` and a snapshot copying the current state |

And with the version flip bundled into a save that also adds a field, removes a field,
adds a block and adds a collection:

| Step | Result |
|---|---|
| Generate with no hints | 13 decisions, including `notes` and `notes__$$locales`, which have nothing to do with versions |
| Generate with a hint per created table | All resolved, no prompt |
| Statement order | Unrelated creates, then renames, then rebuilds, then the `pages` column drops last — the splice point is unmoved |
| Column lists | `pages` has `hero__hero_type` and no `hero__subtitle`; `pages__versions` has the reverse |

The round trip returned the original row exactly, which is the property that matters:
opting in and back out is not supposed to change a document.
