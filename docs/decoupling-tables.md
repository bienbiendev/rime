# Annex — `FeatureDefinition.tables`

> Stage 4.2 of `docs/decoupling.md`. **Landed for auth** (`a7b5bed6`); upload's directories and
> `_generateSchema: false` are still ahead of it. What follows is the reasoning that produced the
> declaration; §7 says where the shipped code differs and what was deliberately left.

---

## 1. The problem, in four places

A feature can already say it wants a **shadow** — a second table holding a prototype's content:

```ts
// core/features/versions/index.ts
shadow: (config) => ({ slug: withVersionsSuffix(config.slug) });
```

It cannot say it wants a table of its own. So four things are hardcoded into the generator.

### 1.1 Four tables, as a string constant

```ts
// adapter-sqlite/generate-schema/templates.server.ts
export const templateAuth = `
export const authUsers = sqliteTable('auth_users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  …
});

export const authSessions = sqliteTable('auth_sessions', { … });
export const authAccounts = sqliteTable('auth_accounts', { … });
export const authVerifications = sqliteTable('auth_verifications', { … });
`;
```

```ts
// adapter-sqlite/generate-schema/index.server.ts
schema.push(templateAuth); // unconditionally, always
if (HAS_API_KEY) {
  schema.push(templateAPIKey);
  enumTables.push('apikey');
}
```

Every rime app gets four better-auth tables whether or not any collection enables auth.

### 1.2 A column, plus a hardcoded slug

```ts
// adapter-sqlite/generate-schema/templates.server.ts
export const templateHasAuth = (slug: string) => `
authUserId: text("auth_user_id").references(() => authUsers.id, { onDelete: 'cascade' }).notNull(),
${slug === 'staff' ? `isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }),` : ''}
`;
```

The database layer knows a collection called `staff` exists and that it is the one with a
super-admin flag.

### 1.3 A flag threaded through the generator

```ts
// generate-schema/index.server.ts
const authConfig = (p: BuiltPrototype) => ('auth' in p ? (p.auth as CollectionAuthConfig | undefined) : undefined);
buildRootTable({ …, hasAuth: !!authConfig(prototype) });

// generate-schema/root.server.ts
if (hasAuth) strFields.push(templateHasAuth(rootName));
```

### 1.4 A collection that exists only to have a table

`upload` derives a `$<slug>Directories` collection so the directories get a table. It carries
`_generateSchema: false` in some places and a hand-written template in others, and its slug has to
be derived through `withoutVersionsSuffix` so a shadow's directories land on its parent's — which
is why `features/upload/naming.ts` imports from `features/versions`.

---

## 2. The declaration

```ts
// core/features/define.ts

/**
 * Tables this feature needs that no prototype declares.
 *
 * A `shadow` deviates a prototype's own table; this is for tables that belong to the feature
 * itself — better-auth's four, a directories tree, an audit log. Read at codegen (to generate
 * them) and at boot (to register them), so a feature adds a table without the schema generator
 * naming it.
 *
 * Asked once per built config, not per prototype: these are not per-collection.
 */
tables?: (config: BuiltConfig) => TableDeclaration[];

/**
 * Columns this feature adds to a *prototype's* table, when that prototype enables it.
 *
 * Separate from `augment`, which adds **fields** — things a document has, that go through
 * validation and the pipeline. This is for storage-only columns: a foreign key to one of the
 * feature's own tables, a flag no form ever writes.
 */
columns?: (config: BuiltCollection | BuiltArea) => ColumnDeclaration[];
```

```ts
// core/features/tables.ts — the vocabulary, in core's terms, no drizzle
export type ColumnType = 'text' | 'integer' | 'real' | 'boolean' | 'timestamp' | 'json';

export type ColumnDeclaration = {
  name: string;
  type: ColumnType;
  primary?: boolean;
  notNull?: boolean;
  unique?: boolean;
  defaultValue?: unknown;
  /** A foreign key, in slug space. The adapter maps slugs to tables; core never names one. */
  references?: { table: string; column?: string; onDelete?: 'cascade' | 'set null' };
};

export type TableDeclaration = {
  /** In slug space, `$`-prefixed for rime-derived. `$authUsers` -> table `auth_users`. */
  slug: string;
  columns: ColumnDeclaration[];
};
```

`ColumnType` is deliberately six values. It is what the existing templates actually emit, and a
wider type is a schema DSL nobody asked for.

---

## 3. What each feature declares

### 3.1 auth

```ts
// core/features/auth/tables.ts
const timestamps: ColumnDeclaration[] = [
  { name: 'createdAt', type: 'timestamp', notNull: true },
  { name: 'updatedAt', type: 'timestamp', notNull: true }
];

export const authTables = (config: BuiltConfig): TableDeclaration[] => {
  // No collection enables auth -> no tables. Today they are emitted unconditionally.
  if (!config.collections.some((c) => c.auth)) return [];

  const tables: TableDeclaration[] = [
    {
      slug: '$authUsers',
      columns: [
        { name: 'id', type: 'text', primary: true },
        { name: 'name', type: 'text', notNull: true },
        { name: 'email', type: 'text', notNull: true, unique: true },
        { name: 'emailVerified', type: 'boolean', notNull: true },
        { name: 'image', type: 'text' },
        { name: 'role', type: 'text' },
        { name: 'banned', type: 'boolean' },
        { name: 'banReason', type: 'text' },
        { name: 'banExpires', type: 'timestamp' },
        { name: 'type', type: 'text', notNull: true },
        ...timestamps
      ]
    },
    { slug: '$authSessions',      columns: [ …, { name: 'userId', type: 'text', references: { table: '$authUsers', onDelete: 'cascade' } } ] },
    { slug: '$authAccounts',      columns: [ …, { name: 'userId', type: 'text', references: { table: '$authUsers', onDelete: 'cascade' } } ] },
    { slug: '$authVerifications', columns: [ … ] }
  ];

  // The api-key table, when any collection asks for that kind of auth.
  if (config.collections.some((c) => c.auth && c.auth.type === 'apiKey')) {
    tables.push({ slug: '$authApiKeys', columns: [ … ] });
  }

  return tables;
};
```

And the column it puts on a collection that enables it — replacing `templateHasAuth`, hardcoded
slug and all:

```ts
// core/features/auth/tables.ts
export const authColumns = (config: BuiltCollection): ColumnDeclaration[] => [
  {
    name: 'authUserId',
    type: 'text',
    notNull: true,
    references: { table: '$authUsers', onDelete: 'cascade' }
  },
  // The staff collection is the one this feature derives, so this feature is the thing that knows
  // which it is. `slug === 'staff'` was the schema generator knowing.
  ...(config.slug === staffSlug(config) ? [{ name: 'isSuperAdmin', type: 'boolean' as const }] : [])
];
```

### 3.2 upload

```ts
// core/features/upload/tables.ts — replaces the derived collection's hand-written table
export const uploadTables = (config: BuiltConfig): TableDeclaration[] =>
  config.collections
    .filter((c) => c.upload && !c.upload.directories === false)
    .map((c) => ({
      slug: withDirectoriesSuffix(c.slug),
      columns: [
        { name: 'id', type: 'text', primary: true },
        {
          name: 'parent',
          type: 'text',
          references: { table: withDirectoriesSuffix(c.slug), onDelete: 'cascade' }
        },
        { name: 'name', type: 'text', notNull: true },
        ...timestamps
      ]
    }));
```

Note the self-reference: a directory's parent is a directory. That is the one shape
`ColumnDeclaration.references` has to support that a prototype's own fields never produce, and it
is why `references` names a **slug** rather than being derived from a relation field.

---

## 4. What the adapter does with it

### 4.1 Codegen

```ts
// adapter-sqlite/generate-schema/index.server.ts
import { tablesOf } from '$lib/core/features/registry.js';

for (const declaration of tablesOf(config)) {
  schema.push(templateDeclaredTable(declaration));
  enumTables.push(baseTableName(declaration.slug));
}
```

```ts
// adapter-sqlite/generate-schema/templates.server.ts — one template, no feature names
export const templateDeclaredTable = (table: TableDeclaration) => `
export const ${baseTableName(table.slug)} = sqliteTable('${baseTableName(table.slug)}', {
${table.columns.map(toSchemaColumn).join(',\n  ')}
});
`;

const toSchemaColumn = (column: ColumnDeclaration) => {
  const drizzle = {
    text: `text('${toSnakeCase(column.name)}')`,
    integer: `integer('${toSnakeCase(column.name)}')`,
    real: `real('${toSnakeCase(column.name)}')`,
    boolean: `integer('${toSnakeCase(column.name)}', { mode: 'boolean' })`,
    timestamp: `integer('${toSnakeCase(column.name)}', { mode: 'timestamp_ms' })`,
    json: `text('${toSnakeCase(column.name)}', { mode: 'json' })`
  }[column.type];

  return [
    `${column.name}: ${drizzle}`,
    column.primary ? '.primaryKey()' : '',
    column.notNull ? '.notNull()' : '',
    column.unique ? '.unique()' : '',
    column.references
      ? `.references(() => ${baseTableName(column.references.table)}.${column.references.column ?? 'id'}, { onDelete: '${column.references.onDelete ?? 'cascade'}' })`
      : ''
  ].join('');
};
```

`templateAuth`, `templateHasAuth`, `templateAPIKey`, `HAS_API_KEY`, `authConfig()` and the
`hasAuth` parameter threaded through `buildRootTable` all delete.

### 4.2 The fold

```ts
// core/features/registry.ts — the same shape as shadowOf / blankWithFeatures
export const tablesOf = (features: FeatureDefinition[], config: Dic): TableDeclaration[] =>
  features.flatMap((feature) => (feature.enabled(config) ? (feature.tables?.(config) ?? []) : []));

export const columnsOf = (features: FeatureDefinition[], config: Dic): ColumnDeclaration[] =>
  features.flatMap((feature) => (feature.enabled(config) ? (feature.columns?.(config) ?? []) : []));
```

> **Careful with `enabled` here.** `tables` is asked of the _whole_ config, and `enabled(config)`
> is written against a _prototype_ config. Either give `tables` its own gate (it already returns
> `[]` when nothing enables the feature) or fold it ungated. Pick one and write down which — this
> is exactly the kind of mismatch that silently emits nothing.

### 4.3 Boot

Declared tables are not prototypes: they have no pipeline, no hooks, no access rules. They should
**not** go through `registerPrototype`. Registration only needs to assert they exist:

```ts
// core/boot.server.ts — after the prototypes are registered
for (const table of tablesOf(config)) {
  adapter.assertTable(table.slug); // throws with a name if the migration has not run
}
```

---

## 5. What this kills

```
templateAuth                    4 tables as a string constant, emitted unconditionally
templateAPIKey / HAS_API_KEY    a fifth, behind a config sniff
templateHasAuth                 a column, plus `slug === 'staff'`
authConfig() / hasAuth          a flag threaded through two files
templateDirectories             already deleted — it was dead
_generateSchema: false          the escape hatch a declaration makes unnecessary
features/upload/naming.ts       the `withoutVersionsSuffix` import, once directories are declared
```

That is the whole of the adapter's remaining 98 `auth` hits except `auth.server.ts`, which is
stage 4.3.

---

## 6. Gates

**The golden schema diff is the gate** (`probing.md` §3), and it is not optional here.

```bash
bun run rime:use versions && bunx vite dev     # once, to generate
cp src/lib/+rime.generated/schema.server.ts /tmp/schema-before.ts
# … make the change …
bunx vite dev
diff /tmp/schema-before.ts src/lib/+rime.generated/schema.server.ts
```

Expect **byte-identical output** for a config that enables auth, and **four fewer tables** for one
that does not. If anything else moves, a column has changed order — and field order is column
order (`CONTRIBUTING.md`), so a reorder is a migration nobody asked for.

Repeat on `basic` (auth + api keys), `versions` (auth + shadows), and `versions-multilang` (all of
it plus locales branches).

---

## 7. What shipped, where it differs

### 7.1 Two members, and where each is gated

`tables` and `columns` both landed as §2 describes. The `enabled` warning in §4.2 was the real
question, and the answer is written into `registry.ts`:

- **`tables` folds ungated.** `enabled` is `(prototypeConfig) => boolean`; `tables` is asked of the
  whole config. Gating there tests the wrong object, and the failure mode is emitting nothing at
  all. Auth's own first line is `if (!collections.some((c) => c.auth)) return []` — `enabled`'s
  test, made at the scope the question has.
- **`columns` folds gated**, like `blankWithFeatures`. It is per-prototype, so the gate is asked of
  the right object.

### 7.2 `ColumnType` has seven values, not six

§2 proposed six. better-auth's own tables store epoch **seconds** in the api-key table and epoch
**milliseconds** everywhere else, so `timestamp` and `timestampMs` are two entries. Collapsing them
would have silently rewritten every api-key timestamp column.

### 7.3 A declared table's name is not derived the way a prototype's is

The annex assumed `baseTableName(declaration.slug)` for both the export name and the SQL name, which
is what Appendix A says for a prototype table. That would have renamed `authUsers` to `auth_users`
in the schema object — and better-auth resolves its models off that object by name, so the four
`modelName`s in `better-auth/config.server.ts` and seven lookups in `adapter-sqlite/auth.server.ts`
would have had to move with it. A rename with no decoupling in it.

`declaredTableProperty` is the rule instead, and it has a reason rather than an exception behind it:

|           | fixed half                   | derived half   |
| --------- | ---------------------------- | -------------- |
| prototype | the authored slug            | the table name |
| declared  | the feature's own identifier | the table name |

A prototype's slug is authored and the table name follows from it. A declared table is the other
way round — the feature chose the identifier and reaches its rows by it. So `$authUsers` exports as
`authUsers` and lives in `auth_users`, and **no table is renamed**.

### 7.4 Left out on purpose

- **`adapter.assertTable`** (§4.3 above). It is boot surface with nothing to catch: `configure`
  derives the staff collection for every config, so auth's tables are always emitted. It lands with
  the first feature whose tables are genuinely conditional.
- **upload's directories and `_generateSchema: false`** (§1.4, §3.2). A separate change with its
  own schema diff, and it is half of §4.6 — the `withoutVersionsSuffix` import goes with it.

### 7.5 The gate, and how to run it without booting vite

§6 says to boot `vite dev` to regenerate. It is not necessary — codegen runs headless:

```bash
rm node_modules/.rime/config.txt          # codegen memoises; this forces a run
bun ./src/lib/core/dev/cli/index.ts generate --force
cp src/lib/+rime.generated/schema.server.ts /tmp/schema-before.ts
# ... make the change, repeat, diff ...
bunx drizzle-kit generate                 # the semantic gate: "No schema changes"
```

The byte diff will never be empty — a generator does not reproduce hand-written whitespace, quote
style or chain order. **Compare the columns, and let `drizzle-kit generate` answer the question the
diff cannot**: it reads the built schema, not the source, so "No schema changes, nothing to migrate"
means the tables are identical however they are spelled.

Captured on `basic` (auth + api keys) and `versions` (auth + shadows). Same tables, same columns,
same order; the only textual difference is `.notNull().references()` where the template wrote
`.references().notNull()`.
