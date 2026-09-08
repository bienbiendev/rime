# Decoupling field traversal

The staged plan for `docs/decouple-field-type-from-parsing.md`. That file is the sketch — the idea
of a `nodes` getter and a path-contribution function. This one is the audit behind it, the contract
that came out of the audit, and the order to build it in.

**Scope decided:** traversal only. Every place that branches on a field type to answer *what is
below me and what does it add to the path*. The places that branch to answer *how is this stored*
are a different contract and are listed in §7 as out of scope, with the reason.

**Measured at `291dbdfc`.** Re-run every grep; the greps are the contract, not the numbers.

```bash
grep -rn "instanceof .*Builder" src | grep -v node_modules | wc -l    # 74, in 25 files
grep -rnE "type === '(blocks|tree|tabs|group|relation)'" src | wc -l  # 12, in 9 files
```

---

## 1. What is actually wrong

Nine walkers, each re-implementing the same ladder:

```ts
if (field instanceof TabsBuilder) {
  for (const tab of field.get.tabs) recurse(tab.get.fields, tab.name);
} else if (field instanceof GroupFieldBuilder) {
  recurse(field.get.fields, `${base}.${field.name}`);
} else if (field instanceof BlocksBuilder) {
  // find the block config by value.type, recurse per array item
} else if (field instanceof TreeBuilder) {
  // recurse per item, then per _children
}
```

Written nine times, they cover different containers:

| walker | tabs | group | blocks | tree |
| --- | :-: | :-: | :-: | :-: |
| `getFieldAtPath` — `core/fields/util.ts:113` | ✔ | ✔ | ✔ | ✔ no `_children` |
| `getFieldListAtPath` — `core/fields/util.ts:179` | ✔ | ✔ | ✔ | ✔ |
| `buildConfigMap` — `core/pipeline/config-map/index.ts:13` | ✔ | ✔ | ✔ | ✔ |
| `validateFields` — `core/config/validate.server.ts:131` | ✔ | ✔ | ✔ | ✔ |
| `generateFieldsTemplates` — `adapter-sqlite/generate-schema/root.server.ts:66` | ✔ | ✔ | ✔ | ✔ |
| `hasLocalizedField` — same file, `:226` | ✔ | ✔ | ✔ | ✔ |
| `emptyValuesFromFieldConfig` — `core/fields/util.ts:51` | ✔ | ✔ | ✘ | ✘ |
| `findTitleField` / `findThumbnailField` — `core/features/{title,thumbnail}/` | ✔ | ✔ | ✘ | ✘ |
| `buildFieldColumns` — `panel/context/collection.svelte.ts:84` | ✔ | ✔ | ✘ | ✘ |

Two things follow from that, and only one of them is a defect.

**A third-party container field is invisible to core.** `$rime/<name>` already makes a field type
installable from a package — `@bienbien/rime-consumer-field` is the proof. A container shipped that
way reaches none of the nine walkers, because none of them can `instanceof` a class they do not
import. Adding a container to the framework today means editing nine files.

**The copies have drifted into two real bugs.**

```ts
// core/pipeline/config-map/index.ts:28 — basePath is dropped, not extended
traverseData(data[tab.name], tab.get.fields, tab.name);
//                                           ^^^^^^^^ should be `${basePath}${tab.name}`
```

A `tabs` nested inside a group or a block keys its children at the tab name with no prefix. Nothing
in `config/validate.server.ts` forbids that nesting.

```ts
// core/pipeline/config-map/build-tree-map.ts:15-19 — one level, form fields only
for (const field of treeConfig.get.fields) {
  if (isFormField(field)) treeMap[`${path}.${field.name}`] = field;
}
```

A group inside a tree row gets no config-map entry, so its children's `beforeRead`, `beforeSave`,
access checks and validation never run. `getFieldAtPath` resolves the same path
(`util.spec.ts:127` asserts `footer.nav.0.group.metaTitle`), so the two disagree.

**The last three rows of the table are not drift.** A title, a thumbnail and a list column each need
a path that can be named before any document exists, and `layout.<which one?>.title` has no such
path — a `blocks` field is a repeater of several shapes and a `tree` field is a repeater of one, so
neither has a determinate child path. Skipping them is correct. What is missing is a way to *say*
that once, instead of nine walkers each deciding for themselves.

---

## 2. The audit

Everything that branches on a field type, grouped by what the branch needs. The first group is what
this plan removes. The rest is §7.

### 2.1 Traversal — the branch only needs "what is below me"

| site | needs |
| --- | --- |
| `core/fields/util.ts:57,61` — `emptyValuesFromFieldConfig` | nested fields, tab name as a value key |
| `core/fields/util.ts:126,141,146,158` — `getFieldAtPath` | nested fields, and how many segments each container consumes |
| `core/fields/util.ts:195,209,217,242` — `getFieldListAtPath` | the same, plus the path prefix to return |
| `core/pipeline/config-map/index.ts:25,42,56,59` | nested fields, per document value |
| `core/pipeline/config-map/build-tree-map.ts:16,28` | tree rows and `_children` |
| `core/config/validate.server.ts:159,201,204` | nested fields only |
| `core/prototype/doc.ts:34,38,40` — `createBlankDocument` | nested fields, and the empty value at a leaf |
| `core/features/title/find-title.ts:38,45` | nested fields, and a determinate path |
| `core/features/thumbnail/find-thumbnail.ts:29,36` | same |
| `panel/context/collection.svelte.ts:87,103` — `buildFieldColumns` | same |
| `adapter-sqlite/generate-schema/root.server.ts:82,90` | nested fields, joined with `__` |
| `adapter-sqlite/generate-schema/root.server.ts:230-266` — `hasLocalizedField` | nested fields only |

### 2.2 Three path grammars, converted by hand at every boundary

| grammar | separator | container marker | produced by |
| --- | --- | --- | --- |
| panel / UI | `.` | `index:blockType`, `._children.n` | `fields/blocks/component/Blocks.svelte:114`, `fields/tree/component/TreeBlock.svelte:103` |
| document / config-map | `.` | bare `index`, type stripped | `core/pipeline/config-map/index.ts:48` |
| SQL column / relation row | `__` | none — containers become tables | `adapter-sqlite/generate-schema/root.server.ts:83,92`, `adapter-sqlite/with.server.ts:35` |

`normalizeFieldPath` (`util/path.ts:17`) is the single converter from the first to the second, and it
is already called on the way into `getValueAtPath`, `setValueAtPath` and `deleteValueAtPath`
(`util/object.ts:218,247,309`).

### 2.3 The constraint that decides the design

Config-map keys are the on-disk path format. `Object.keys(configMap)` becomes `incomingPaths`
(`core/pipeline/run.server.ts:274`), and three persist modules use it as a prefix namespace:

```ts
// pipeline/persist/blocks/index.server.ts:61
// pipeline/persist/tree/index.server.ts:46
// pipeline/persist/relations/index.server.ts:69
incomingPaths.some((path) => block.path?.startsWith(path));
```

`extractRelations` writes a config-map key verbatim into the relations table's `path` column
(`persist/relations/extract.server.ts:31`); `extractBlocks` writes `normalizeFieldPath` of one
(`persist/blocks/extract.server.ts:26`). So a config-map key **must not** gain a `:blockType`
segment — that changes `startsWith` matching against paths already written to disk.

### 2.4 Already done, do not redo

The source doc asks for type generation to move into the fields with a dedupe pass. Both halves
exist. `field.use.generateType()` is a `protected` method each builder overrides — `BlocksBuilder`
emits one `Block<Name>` per block type (`fields/blocks/index.ts:88-109`), `TreeBuilder` emits a
self-referential `Tree<Name>` (`fields/tree/index.ts:94-106`) — and the codegen's whole field step
is one line:

```ts
// core/dev/codegen/types/index.server.ts:64-66
const buildFieldsTypes = async (fields: FieldBuilder<Field>[]): Promise<string[]> =>
  fields.map((field) => field.use.generateType()).filter(Boolean);
```

The dedupe is `//@shared:start <name>` / `//@shared:end`, extracted and hoisted by
`parseSharedTypes` (`core/dev/codegen/types/index.server.ts:107-137`). The sketch calls it
`@dedupe`; the built version calls it `@shared`. Nothing to build here.

---

## 3. The contract

Two methods on `.use`, and one optional field on the node they return.

```ts
// core/fields/builders/field-builder.ts

/** One branch below a field: what it adds to the path, and the fields under it. */
export type FieldNode = {
  /**
   * The segment this branch contributes below the field's own name.
   * '' when it contributes nothing — Group, whose own name is already the segment.
   * '#' stands for an index that only a document can supply.
   */
  segment: string;
  /**
   * When set, the branch nests into itself through this segment, so `nav.0`,
   * `nav.0._children.1` and deeper are all this same branch. Read only when
   * resolving a path (§5); the value walk flattens the recursion itself.
   */
  repeatVia?: string;
  fields: FieldBuilder[];
};

/** A branch a real value has: a concrete segment, no '#', and the data under it. */
export type ValueNode = FieldNode & { value: unknown };

export type FieldUse = {
  accessRead(...args: Parameters<FieldAccess>): boolean;
  accessCreate(...args: Parameters<FieldAccess>): boolean;
  accessUpdate(...args: Parameters<FieldAccess>): boolean;
  generateType(): string;
  /** Every branch this field can produce, from the config alone. */
  nodes(): FieldNode[];
  /** The branches this particular value has. */
  nodesFor(value: unknown): ValueNode[];
};
```

`FieldBuilder.use` returns `nodes: () => []` and `nodesFor: () => []`, so every leaf field is
correct without being touched, and so is every field a consumer ships in a package.

### Why `.use` and not `.get`

`.get` is documented as plain data reads and `.use` as behaviour the builder performs on your
behalf (`core/fields/builders/field-builder.ts:82-105`). Both new methods compute a view over
`this.field.{tabs,blocks,fields}` rather than reading a stored member, and `.get`'s spread already
surfaces the raw `tabs` / `blocks` / `fields` they derive from — `field.get.fields` keeps working
and keeps meaning what it means today.

It also avoids a collision that has bitten this repo before. `TreeBuilder`, `GroupFieldBuilder`,
`TabBuilder` and `BlockBuilder` each have a fluent `.fields(...)` **setter**, so a reader named
`fields` on the class would shadow it — the same shape as the `.required()` / `field.required`
problem that `.get` and `.use` were introduced to solve.

### Why two methods

Because Blocks and Tree fan out from the **data**, and half the callers have no data.

```ts
const layout = blocks('layout', [
  block('hero').fields(text('title')),
  block('cta').fields(text('label'))
]);

// The schema generator and config validation need every block type the config declares:
layout.use.nodes();
// [ { segment: '#:hero', fields: [ text('title'), … ] },
//   { segment: '#:cta',  fields: [ text('label'), … ] } ]

// The config map needs the blocks this one document actually has, in order:
layout.use.nodesFor([
  { type: 'cta', label: 'Buy' },
  { type: 'cta', label: 'Read' }
]);
// [ { segment: '0:cta', fields: [ text('label'), … ], value: { type: 'cta', label: 'Buy'  } },
//   { segment: '1:cta', fields: [ text('label'), … ], value: { type: 'cta', label: 'Read' } } ]
```

Two documents in the same collection give different `nodesFor` and identical `nodes`. Folding them
into a single `nodes(value?)` would make "walking a config" and "walking a document whose field
happens to be absent" the same call, which is exactly the confusion the shape invites.

For the containers that do not depend on data, the two return the same branches:

```ts
const attributes = group('attributes').fields(text('title'));

attributes.use.nodes();
// [ { segment: '', fields: [ text('title') ] } ]

attributes.use.nodesFor({ title: 'hello' });
// [ { segment: '', fields: [ text('title') ], value: { title: 'hello' } } ]
```

---

## 4. The four containers

Each is a `use` override. `super.use` inside an overridden getter is the shape
`FormFieldBuilder.use` already uses to extend `FieldBuilder.use`
(`core/fields/builders/form-field-builder.ts:167`).

### Group — the field's own name is the segment, the branch adds nothing

```ts
// fields/group/index.ts
override get use() {
  return {
    ...super.use,
    nodes: (): FieldNode[] => [{ segment: '', fields: this.field.fields }],
    nodesFor: (value: unknown): ValueNode[] => [
      { segment: '', fields: this.field.fields, value }
    ]
  };
}
```

```
group('attributes').fields(text('title'))
  data:  { attributes: { title: 'hello' } }
  paths: attributes  ·  attributes.title
```

### Tabs — the builder has no name, so each tab is the only segment

```ts
// fields/tabs/index.ts
override get use() {
  return {
    ...super.use,
    nodes: (): FieldNode[] =>
      this.field.tabs.map((t) => ({ segment: t.name, fields: t.get.fields })),
    nodesFor: (value: unknown): ValueNode[] =>
      this.field.tabs
        .filter((t) => isObjectLiteral(value) && t.name in (value as Dic))
        .map((t) => ({ segment: t.name, fields: t.get.fields, value: (value as Dic)[t.name] }))
  };
}
```

```
tabs(tab('meta').fields(text('title')), tab('seo').fields(text('description')))
  data:  { meta: { title: 'hello' }, seo: { description: 'x' } }
  paths: meta.title  ·  seo.description        (no segment for the tabs field itself)
```

### Blocks — `#` when declared, the real index when there is data

```ts
// fields/blocks/index.ts
override get use() {
  return {
    ...super.use,
    nodes: (): FieldNode[] =>
      this.field.blocks.map((b) => ({ segment: `#:${b.name}`, fields: b.get.fields })),
    nodesFor: (value: unknown): ValueNode[] =>
      (Array.isArray(value) ? value : []).flatMap((item, index) => {
        const block = this.field.blocks.find((b) => b.name === item?.type);
        // Residual data for a block type that no longer exists. The current
        // traverseData wraps this in a try/catch and warns; skipping is the
        // same outcome without the throw.
        if (!block) return [];
        return [{ segment: `${index}:${block.name}`, fields: block.get.fields, value: item }];
      })
  };
}
```

```
blocks('layout', [block('hero').fields(text('title'))])
  data:  { layout: [ { type: 'hero', title: 'hello' } ] }
  paths: layout  ·  layout.0:hero.title      → normalized for the config map: layout.0.title
```

### Tree — one declared branch; `nodesFor` flattens the `_children` recursion

```ts
// fields/tree/index.ts
override get use() {
  return {
    ...super.use,
    nodes: (): FieldNode[] => [
      { segment: '#', repeatVia: '_children', fields: this.field.fields }
    ],
    nodesFor: (value: unknown): ValueNode[] => {
      const out: ValueNode[] = [];
      const walk = (items: unknown, prefix: string) => {
        if (!Array.isArray(items)) return;
        items.forEach((item, index) => {
          const segment = prefix ? `${prefix}._children.${index}` : `${index}`;
          out.push({ segment, fields: this.field.fields, value: item });
          walk(item?._children, segment);
        });
      };
      walk(value, '');
      return out;
    }
  };
}
```

```
tree('nav').fields(text('label'))
  data:  { nav: [ { label: 'a', _children: [ { label: 'b' } ] } ] }
  paths: nav  ·  nav.0.label  ·  nav.0._children.0.label
```

That reproduces `buildTreeFieldsMap`'s keys exactly (`build-tree-map.ts:30,38`), and because the
generic walk then recurses into whatever fields the node returns, a group nested in a tree row is
covered for free.

---

## 5. The three functions

New module `core/fields/walk.ts`. It must stay isomorphic — `documentForm.svelte.ts:722` calls
`buildConfigMap` in the browser — so nothing here imports a `.server.ts`.

Generators, so a caller can stop at the first hit (`findTitleField`) or fold every visit
(`buildConfigMap`) without two shapes of helper.

```ts
// core/fields/walk.ts
export type Visit = { field: FieldBuilder; path: string; value: unknown };

const joinPath = (parent: string, part: string) =>
  parent && part ? `${parent}.${part}` : parent || part;

type WalkOptions = {
  path?: string;
  /** The schema generator joins with `__`. */
  join?: (parent: string, part: string) => string;
  /** Skip branches whose segment holds a '#' — a path no config alone can name. */
  determinate?: boolean;
};
```

### `walkFields` — every field the config declares

```ts
export function* walkFields(
  fields: FieldBuilder[],
  { path = '', join = joinPath, determinate = false }: WalkOptions = {}
): Generator<Visit> {
  for (const field of fields) {
    const own = field.name ? join(path, field.name) : path;
    yield { field, path: own, value: undefined };
    for (const node of field.use.nodes()) {
      if (determinate && node.segment.includes('#')) continue;
      yield* walkFields(node.fields, { path: join(own, node.segment), join, determinate });
    }
  }
}
```

### `walkValues` — every field a document actually carries

```ts
export function* walkValues(
  fields: FieldBuilder[],
  data: unknown,
  { path = '', join = joinPath }: WalkOptions = {}
): Generator<Visit> {
  for (const field of fields) {
    // A named field absent from the data contributes nothing, matching
    // traverseData's `if (!(field.name in data)) continue`.
    if (field.name && !(isObjectLiteral(data) && field.name in (data as Dic))) continue;
    const own = field.name ? join(path, field.name) : path;
    const value = field.name ? (data as Dic)[field.name] : data;
    yield { field, path: own, value };
    for (const node of field.use.nodesFor(value)) {
      yield* walkValues(node.fields, node.value, { path: join(own, node.segment), join });
    }
  }
}
```

Against the four shapes:

| field | its own path | node segments | resulting child paths |
| --- | --- | --- | --- |
| `text('title')` | `title` | — | — |
| `group('attributes')` | `attributes` | `''` | `attributes.title` |
| `tabs(tab('meta'))` | the parent's path | `meta` | `meta.title` |
| `blocks('layout')` | `layout` | `#:hero` declared, `0:hero` with data | `layout.0:hero.title` |
| `tree('nav')` | `nav` | `#` declared, `0` and `0._children.1` with data | `nav.0._children.1.label` |

Tabs falls out of `field.name ? … : path`. A `TabsBuilder` has no name, so it contributes no
segment and each tab contributes its own. That is the sketch's "PIA not considered as formField but
holds data", answered without a special case.

`determinate: true` is the whole of the last three rows of §1's table. It is one rule stated once —
a path with an index in it cannot be named from a config — rather than three walkers each deciding
to omit blocks and tree.

### `matchPath` — resolving a path back to a field

`getFieldAtPath` and `getFieldListAtPath` run the other direction: they consume segments and match
each against the declared nodes.

```ts
// core/fields/walk.ts
const escapeRegex = (s: string) => s.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');

/** '#:hero' matches '0:hero' · '#' matches '7' · 'meta' matches only 'meta' */
const matchesSegment = (pattern: string, segment: string) =>
  new RegExp(`^${pattern.split('#').map(escapeRegex).join('\\d+')}$`).test(segment);
```

`\d+` for an index is the convention `pathToRegex` (`core/fields/util.ts:91`) already uses, so the
two agree.

`repeatVia` is the one clause on top: while the next two segments are `_children` and something the
pattern matches, stay in the same node. That closes a gap rather than preserving one — today
`getFieldAtPath` does a blind `remainingParts.slice(2)` for a tree (`util.ts:158`) and cannot
resolve `nav.0._children.1.label` at all.

`util.spec.ts`'s 11 path cases are the gate for this section. Do not edit them: they are the
specification of both dialects, including the deliberate `undefined` for a blocks path missing its
`:type` (`util.spec.ts:143`).

---

## 6. The steps

Eleven commits. The first two are additive and touch no caller, so every gate stays at baseline and
the shape can be reviewed before anything moves.

### 1 — the primitive

`core/fields/builders/field-builder.ts`: `FieldNode`, `ValueNode`, the two members on `FieldUse`,
and the empty defaults in `FieldBuilder.use`. `core/fields/walk.ts`: `walkFields`, `walkValues`,
`matchesSegment`, `joinPath`. No call site changes.

### 2 — the four containers

`fields/{group,tabs,blocks,tree}/index.ts`, exactly §4. Still no call site changes: nothing calls
`nodes` yet.

A unit spec here is cheap and worth it — assert the node lists for the `util.spec.ts:28-56` field
tree, which already has tabs, a group, blocks with two types, and a tree with a nested group.

### 3 — `findTitleField`

```ts
// core/features/title/find-title.ts   48 lines → 6
export function findTitleField(fields: FieldBuilder<Field>[] = [], basePath = '') {
  for (const { field, path } of walkFields(fields, { path: basePath, determinate: true })) {
    if (isFormField(field) && hasMaybeTitle(field.get) && field.get.isTitle === true) {
      return { field, path };
    }
  }
  return null;
}
```

Byte-identical output by construction: `determinate: true` descends group and tabs and stops at
blocks and tree, which is what the four `instanceof` branches did.

### 4 — `findThumbnailField`

The same body with the `isThumbnail` predicate (`core/features/thumbnail/find-thumbnail.ts`). This
is the sketch's own worked example.

### 5 — `hasLocalizedField`

```ts
// adapter-sqlite/generate-schema/root.server.ts:226-271   45 lines → 2
const hasLocalizedField = (fields: FieldBuilder<Field>[]) =>
  [...walkFields(fields)].some((v) => isFormField(v.field) && v.field.get.localized);
```

No `determinate` — it asks a question about the whole config, and a `#` in a path it never reads
costs nothing. The current version short-circuits on `field.get.localized` for blocks and tree
before recursing; the generic walk reaches the same answer because that flag is on the container
field, which the walk visits.

### 6 — `buildFieldColumns`

`panel/context/collection.svelte.ts:84-112`, `walkFields({ determinate: true })` plus the existing
`hasProp('table', field.get)` predicate. Panel code — gate with `probing.md` §7, not just `check`.

### 7 — the config map

```ts
// core/pipeline/config-map/index.ts — 67 lines, plus build-tree-map.ts's 43, become this
export const buildConfigMap = (
  data: DeepPartial<GenericDoc>,
  incomingFields: FieldBuilder<Field>[]
): ConfigMap => {
  const map: ConfigMap = {};
  for (const { field, path } of walkValues(incomingFields, data)) {
    if (isFormField(field)) map[normalizeFieldPath(path)] = field;
  }
  return map;
};
```

`normalizeFieldPath` (`util/path.ts:17`) strips the `:blockType` the blocks node emits, so keys stay
in the grammar §2.3 calls the document grammar and §2.4 requires. Delete
`core/pipeline/config-map/build-tree-map.ts`.

**Do not** let `:blockType` into a config-map key. §2.3 is the reason: the keys are compared with
`startsWith` against `path` columns already written to disk.

This is the one commit that changes behaviour. See §8.

### 8 — `createBlankDocument`

`core/prototype/doc.ts:32-56` becomes `walkFields` plus `field.use.defaultValue({ event })` at each
leaf, writing into a nested object keyed by the walk's path.

Its `['blocks', 'relation', 'tree'].includes(curr.type) → []` branch (`doc.ts:38`) is redundant for
blocks and tree — both constructors already set `this.field.defaultValue = []`
(`fields/blocks/index.ts:23`, `fields/tree/index.ts:17`). **Check `RelationFieldBuilder`'s
constructor before deleting the line.** If it has no default, give it `defaultValue = []` there
rather than keeping the branch — a default belongs in the constructor, which runs before any
consumer chaining.

Keep the comment at `doc.ts:43-46`: presentational fields are plain `FieldBuilder` with `name === ''`
and must not be assigned, or the parent object goes array-like once flattened. The `isFormField`
filter is what preserves that.

### 9 — config validation

`core/config/validate.server.ts:157-210` folds `walkFields` with no `determinate` — it must reach
every block type.

Two of its branches are not traversal and stay:

- `:186` — "two blocks with the same name must be identical" compares whole `BlockBuilder` objects
  against a `registeredBlocks` map. A `FieldNode` carries `fields`, not the block. It is a blocks
  rule, not a walk; leave the `instanceof BlocksBuilder` and say so in the commit message.
- `:207` — `validateRelationField` is a relation rule, same reasoning.

### 10 — the two path resolvers

`core/fields/util.ts:113` and `:179`, rewritten on `matchesSegment` per §5. The larger of the two
commits and the one with a real spec behind it. Panel code by way of `LiveEditPanel.svelte:44` —
gate with `probing.md` §7.

`emptyValuesFromFieldConfig` (`util.ts:51`) goes in this commit too; it is the same file and a
three-line fold.

### 11 — the schema generator's group and tabs half

`adapter-sqlite/generate-schema/root.server.ts:66-181`. Group and tabs flatten into a `__`-joined
column prefix, which is `walkFields` with a different joiner:

```ts
walkFields(fields, { join: (parent, part) => (parent ? `${parent}__${part}` : part) });
```

Blocks, tree and relation stay branched in this function — see §7.

**The golden schema diff is the gate for this commit** (`probing.md` §3). Field order is column
order (`cold-start.md` rule 2), and `walkFields` yields in declaration order, which is what the
nested loops do today. Nothing else catches a reorder.

---

## 7. Out of scope, and why

Four clusters look like the same problem. They branch to answer **how a field is stored**, which
`nodes` cannot answer:

```
adapter-sqlite/generate-schema/root.server.ts:96   relation → relationFieldsMap, no column
adapter-sqlite/generate-schema/root.server.ts:107  blocks   → one child table per block type
adapter-sqlite/generate-schema/root.server.ts:142  tree     → one child table for the field
core/pipeline/persist/{blocks,tree,relations}/extract.server.ts   the same three, writing rows
adapter-sqlite/with.server.ts:38,42,73             the `with` clause per storage kind
core/prototype/collection/operations/duplicate.ts:103  "only tree and blocks" = "owns its own rows"
```

These want a second declaration — a field saying what it stores — which is
`architecture-target.md` §6's unbuilt `type: 'child'`:

> **`type: 'child'`** — a table owned by the prototype's rows, `{base}__$relation` […] Blocks and
> relations are the two candidates; both are currently persisted by `core/pipeline/persist/` rather
> than by a feature.

That is a contract change reaching the `Adapter` interface, and it is its own piece of work.

`panel/components/fields/RenderFields.svelte:35-64` also stays. It dispatches to `field.component`,
which is already polymorphic, and its `isTabsField` branch is a layout decision.

Expected after step 11: **74 `instanceof` hits down to roughly 30**, all in the clusters above plus
the builders' own `localized()` overrides, which walk their own children to clone them and are not
traversal by anyone else.

---

## 8. What changes behaviour, and where

Steps 3, 4, 5, 6 and 11 are byte-identical by construction. Step 7 is not, in two ways, and both
are fixes:

1. A tab nested under a group or a block keys with its full prefix. `config-map/index.ts:28` drops
   the prefix today.
2. A group, tabs or blocks field nested inside a tree row gets config-map entries it never had, so
   its children's `beforeRead`, `beforeSave`, access checks, default values and validation now run.
   `build-tree-map.ts` mapped only the tree's own form fields.

Land step 7 on its own, with the before and after key lists in the commit message.

Step 10 also gains: `getFieldAtPath('nav.0._children.1.label', fields)` resolves, where today the
blind `slice(2)` returns `undefined`.

Two defects found during the audit and **not** fixed here, because neither is traversal:

- `util/object.ts:221` — `if (/^d+$/.test(part))`, a missing backslash, so the numeric branch of
  `getValueAtPath` never fires. Benign only because JS array indexing accepts string keys.
- `core/pipeline/persist/blocks/extract.server.ts:36` — `@TODO should maybe remove tree also`.
  Nested tree values are not stripped from a block row before persist; nested blocks are.

Both belong in `known-defects.md` rather than in this plan.

---

## 9. Verification

Baselines are per fixture (`probing.md` §1). Measure on the same one before and after.

```bash
bun run rime:use versions && git checkout hooks.generated.md
bun run check                 # 0 on versions · 13 on basic · 6 on versions-multilang
bunx eslint src/lib           # 21
bun run check:circular-deps   # 3 — the list matters more than the count
bunx vitest run               # 124 · util.spec.ts's 11 path cases gate step 10
```

Three gates discriminate for this work specifically.

**The golden schema diff**, around step 11 (`probing.md` §3). Capture per fixture before the change,
repeat after, diff. A reordered column is the failure this catches and the only one that does.

**A config-map key diff**, around step 7. The keys are the on-disk path format (§2.3), so a changed
key is a silently dropped field. Cheapest capture is a temporary log in the hook that builds it:

```ts
// core/pipeline/steps/data-config-map.server.ts — remove before committing
console.log(JSON.stringify(Object.keys(map).sort(), null, 2));
```

Run it against a document exercising all four containers — the `fields` fixture has one — before and
after, and diff the two lists. Expect exactly the two additions §8 describes and nothing else. The
`fields` e2e suite (72 passing in this container, 22 failing only on the Chromium revision) is the
broader net.

**`probing.md` §7**, once, after steps 6 and 10. `collection.svelte.ts` and `getFieldListAtPath` are
panel and live-edit paths; no static gate sees them, and §7 drives Chromium 1194 through
`playwright-core` directly.

---

## 10. Traps

- **`walk.ts` must stay isomorphic.** `panel/context/documentForm.svelte.ts:722` calls
  `buildConfigMap` in the browser. A `.server.ts` import here reaches the client graph and SvelteKit
  answers `An impossible situation occurred` without naming the file — `cold-start.md` rule 7, the
  one that cost the whole panel.
- **Declaration order is column order.** `walkFields` yields a field before its children and yields
  siblings in array order. Do not sort, do not collect into a `Set`, do not `Promise.all` the
  visits.
- **`.get.fields` keeps working.** Nothing in this plan removes it, and several call sites outside
  traversal read it directly. `nodes` is an addition, not a replacement.
- **A `TabsBuilder` is not a `FormFieldBuilder`.** It has no name and no access members, which is
  why `FieldBuilder.get` forces `localized: false, root: false`
  (`core/fields/builders/field-builder.ts:82-90`). Every consumer of a walk still filters with
  `isFormField` before reading a form-field member.
- **Blocks `nodesFor` skips an unknown block type.** The current `traverseData` wraps the lookup in
  a `try`/`catch` and warns (`config-map/index.ts:50-54`). Keep a warn if the log is wanted, but the
  skip is the same outcome — residual data for a deleted block type gets no config entry either way.
