# Relation and rich-text helpers

One way to do each thing, from `rimecms/public`, with no panel import. No compatibility layer: the
old helpers are removed in the same release, with a Breaking Change note.

## The big picture

A relation value takes one of these shapes:

| Where              | Shape                                                        |
| ------------------ | ------------------------------------------------------------ |
| read at depth 0    | refs `[{ relationTo, documentId }]`                          |
| read at depth ≥ 1  | documents `[{ id, _type, … }]`                               |
| live edit          | refs carrying `livePreview`                                  |
| empty              | `null`, `[]`                                                 |
| a write, a default | bare ids `'abc'`, `['abc']`; the server turns them into refs |

Three tools, each answering one question:

| Question                                                 | Tool                                                                              | Who                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| I set the depth on the server: what do I get?            | `WithRelationResolved<Doc, D>`, returned by `find({ depth })` and the other reads | `load` functions, server code: `page.hero.thumbnail[0]`, no helper       |
| I want the documents, and I don't know if they are there | `Relation.resolve(value).first()` / `.all()`                                      | site components, panel previews, live edit, `RelationInline`, `populate` |
| I hold an entry: is it a ref or a document?              | `Relation.isRef(entry)`                                                           | the thumbnail hook, `populate`, `RelationInline`, `resolve` itself       |

The rule for whoever uses rime:

1. Set the depth on the server, and read the field: its type follows the depth.
2. Otherwise, in the browser: `Relation.resolve(…)`.
3. To branch yourself: `Relation.isRef(…)`.

Next to it, in the same style: `RichText.toText(…)`.

Apart from the tools: the write-path and panel bugs found by the same audit, each fixed in its own
file (see [Bugs fixed in place](#bugs-fixed-in-place)).

Ruled out: a `refs` reader or any normalizer, `resolve(value, reader)`, a synchronous `first`,
`.docs`, and the old `isRelation*` helpers and `resolveRelation`.

## 1. Types follow `depth`: `WithRelationResolved`

```ts
const page = await rime.collection('pages').findById({ id, depth: 1 });
page.hero.thumbnail[0].sizes.md; // MediasDoc
page.sections[0].image[0].alt; // a block's relation, resolved too
page.author[0].avatar; // RelationValue<MediasDoc>: the author was read at depth 0
```

`WithRelationPopulated<T>` is renamed `WithRelationResolved<T, D = 1>`. Each relation becomes the
related type at one depth less, as `populate-relations.server.ts:55` reads it; the document's own
groups, tabs and blocks keep the depth.

**It must tell a relation from any other array.** Today's type tests
`T[K] extends RelationValue<infer U>`, and `RelationValue` has a `U[]` arm, so every array of
objects matches: `sections: Block[]` is taken for a relation and never walked, and a block's image
stays untyped at any depth. A relation field's type is the only one whose union holds
`RelationRef[]`:

```ts
type Prev = [never, 0, 1, 2, 3];

export type WithRelationResolved<T, D extends number = 1> = D extends 0
  ? T
  : {
      [K in keyof T /* primitives as today */]: RelationRef[] extends NonNullable<T[K]>
        ? NonNullable<T[K]> extends RelationValue<infer U>
          ? WithRelationResolved<U, Prev[D]>[]
          : T[K]
        : T[K] extends Array<infer E>
          ? Array<WithRelationResolved<E, D>>
          : T[K] extends object
            ? WithRelationResolved<T[K], D>
            : T[K];
    };
```

The read methods take the depth as a type parameter:

```ts
find<D extends number = 0>(args: FindArgs & { depth?: D }): Promise<WithRelationResolved<Doc, D>[]>;
```

| File                                      | Lines                                             |
| ----------------------------------------- | ------------------------------------------------- |
| `core/prototype/collection/api.server.ts` | 153 (`find`), 213 (`findById`), 245 (`findByIds`) |
| `core/prototype/area/api.server.ts`       | 103 (`find`)                                      |

- A literal `depth: 1` or `depth: 2` gives the exact type. No `depth`, `depth: 0`, or a depth in a
  `number` variable gives `Doc`, as today. Past depth 4, `Prev` runs out and the type is `Doc`'s.
- A document fetched over HTTP (`/api/pages/1?depth=1`) is cast once:
  `as WithRelationResolved<PagesDoc, 1>`.
- A component typing its props with the raw generated type (a site block's `block: BlockCard`)
  gains nothing from this: it reads with `Relation.resolve`.

| `WithRelationPopulated` today                                                                                          | Becomes                                                                  |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `core/fields/types.ts:11,28,30` (definition), `types.ts:55` (export), `live/Consumer.svelte:3,7,19`, `util/types.ts:3` | `WithRelationResolved`; `LiveConsumer` keeps depth 1                     |
| docs site `components/pages/Page.svelte:16,21`, `home/Home.svelte:8,11`                                                | `PagesDoc`: the load reads with no depth, and `PagesDoc` has no relation |

## 2. `Relation.resolve`

```ts
import { Relation } from 'rimecms/public';

Relation.resolve(block.image).first(); // MediasDoc | null
Relation.resolve(block.images).all(); // MediasDoc[]
```

| Value                                         | `first()`                   | `all()`                      |
| --------------------------------------------- | --------------------------- | ---------------------------- |
| `null`, `undefined`, `false`, `[]`, any other | `null`                      | `[]`                         |
| a document, or documents                      | the first, no request       | all of them, no request      |
| a ref, or refs                                | a promise, fetched          | a promise, fetched           |
| refs carrying `livePreview`                   | the preview doc, no request | the preview docs, no request |
| documents and refs mixed                      | a promise, refs fetched     | a promise, refs fetched      |
| refs, during server rendering                 | a promise left pending      | a promise left pending       |

- **What reads as what.** `Relation.isRef(entry)` first: a ref, whatever else it carries. Then an
  object with `id` and `_type` is a document. Anything else, a bare id included, is nothing: it
  names no collection to fetch from.
- A ref whose document cannot be fetched (deleted, refused) is left out.
- **The value, or a promise.** Svelte's `{#await}` renders `{:then}` at once for a value that is not
  a promise, on the server too; a promise renders only the pending branch there. So a page read at
  depth 1 is server-rendered with its images, and a panel preview, which holds refs, fetches them.
  `await` and `{#await}` take either; TypeScript refuses `.then` on `T | Promise<T>`.
- **No request during server rendering.** The fetch goes to `/api/…`, which Node cannot resolve on
  its own. Refs give a promise that stays pending, and the browser fetches once it hydrates.
- **One fetcher.** `fetchDoc` moves out of `relation/populate.ts` into `relation/fetch.ts`, shared
  with `populate`: `${API_PREFIX}/${toKebabCase(slug)}/${id}?depth=1`, one request per document
  for the page's life, `populate.clear()` clears it. It replaces `resolveRelationRef`'s fetch: a
  relative `api/…` URL, wrong under any nested route (`/panel/pages/<id>` becomes
  `/panel/pages/api/…`), no kebab case, no cache.

### Scenarios

**A site block, whatever depth it was read at.** Documents render at once, refs are fetched:

```svelte
<script lang="ts">
  import { Relation } from 'rimecms/public';
  const { block }: { block: BlockCard } = $props();
</script>

{#await Relation.resolve(block.image).first() then image}
  {#if image}<img src={image.sizes.md} alt={image.alt} />{/if}
{/await}
```

**All of them: a gallery.**

```svelte
{#await Relation.resolve(block.images).all() then images}
  {#each images as image (image.id)}
    <img src={image.sizes.md} alt={image.alt} />
  {/each}
{/await}
```

**A placeholder while it fetches.** It never shows when the documents are already there:

```svelte
{#await Relation.resolve(block.image).first()}
  <div class="placeholder"></div>
{:then image}
  {#if image}<img src={image.sizes.md} alt={image.alt} />{/if}
{/await}
```

**Panel: a group preview or a block render.** Form values hold refs:

```svelte
<script lang="ts">
  import { Relation } from 'rimecms/public';
  import type { FieldsPreviewProps } from 'rimecms/types';

  const { fields }: FieldsPreviewProps = $props();
</script>

{#await Relation.resolve(fields.thumbnail.value).first() then media}
  {#if media}<img src={media.sizes.md} alt={media.alt} />{/if}
{/await}
```

**Live edit.** The value carries the edited document, rendered with no request:

```svelte
<LiveEdit path="hero.thumbnail" data={doc.hero.thumbnail}>
  {#snippet child(thumbnail, props)}
    {#await Relation.resolve(thumbnail).first() then media}
      {#if media}<img {...props} src={media.sizes.md} alt={media.alt} />{/if}
    {/await}
  {/snippet}
</LiveEdit>
```

**In a browser script.**

```ts
const author = await Relation.resolve(doc.author).first();
if (author) greet(author.name);
```

### Where it is used

| Where                                                                   | Today                                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `relation/populate.ts:51-54`                                            | its own ref detection and fetch                                              |
| `relation/component/RelationInline.svelte:48-61`                        | a hand-built ref, `populate`, then `'_type' in doc`                          |
| `relation/component/Relation.svelte:125-128,153-156`                    | a saved ref that no longer matches the field's `.query()` is dropped (bug 6) |
| `tests/basic/routes/(front)/[[id]]/+page.svelte:25,44`                  | `isRelationResolved`, `as MediasDoc`, `.at(0)`                               |
| `tests/multilang/routes/(front)/[[locale]]/[[id]]/+page.svelte:13,30`   | `resolveRelation(…).then((r) => r?.at(0))`, never server-rendered            |
| kit `src/+rime/Hero.svelte` (group preview)                             | `resolveRelation`, broken URL: its `<img>` is commented out                  |
| kit `site/blocks/card/Card.svelte:9-13`, `gallery/Gallery.svelte:14-16` | `isRelationPopulated` guards; a ref without `id` gives `<img src=undefined>` |
| docs `05-fields/014-relation.md:97-134`                                 | the old helpers                                                              |

Not used on the server: a `load`, a hook or an endpoint reads with the rime API and a `depth`. The
write path does not want documents either: `ensureRelationExists` checks ids with the user's auth
headers and `select=id`; `extractRelations` builds rows.

## 3. `Relation.isRef`

```ts
Relation.isRef(value): value is RelationRef // an object with relationTo and documentId
```

One test, typed, where each caller tests it its own way today:

| Where                                                 | Today                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `thumbnail/hooks/set-document-thumbnail.server.ts:44` | `isRelationResolved`: wants `title`, `_prototype` and `_type` |
| `relation/populate.ts:33`                             | `'documentId' in value && 'relationTo' in value`              |
| `relation/component/RelationInline.svelte:55`         | `'_type' in doc`, read the other way round                    |
| `Relation.resolve`                                    | the same test, inside                                         |

The thumbnail hook then reads:

```ts
if (shouldSetThumbnail) {
  // At depth 0 the relation holds a ref to the media; at depth 1 or more, the media itself.
  const value = getValueAtPath<RelationValue<UploadDoc>>(config.asThumbnail, doc);
  const first = Array.isArray(value) ? value[0] : value;
  if (!first || typeof first === 'string') return args;

  const media = Relation.isRef(first) ? await readMedia(first) : first;
  doc = { _thumbnail: media._thumbnail, ...doc };
}

const readMedia = (ref: RelationRef) =>
  args.event.locals.rime.collection(ref.relationTo).findById({ id: ref.documentId });
```

A document has `id` and `_type` but no `documentId`, so it is used as is: its `_thumbnail` was set
by `populateSizes` when it was read at depth 1. Only a ref costs a `findById`.

## 4. `RichText.toText`

```ts
import { RichText } from 'rimecms/public';

RichText.toText(block.text); // was richTextJSONToText
```

`RenderRichText` stays a component of its own: a static `RichText.Render` would make every
`RichText.toText` import, server code included, pull in the component and tiptap, since a class's
static properties are not tree-shaken. `isJSONContent` stays internal.

## Removed from `rimecms/public`

| Export                 | rime                                                                                                                                                                                                                                                                  | `@rimecms`                                                                                                                                                      | Becomes                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `isRelationPopulated`  | `public.ts:7,28`; `relation/util.spec.ts`                                                                                                                                                                                                                             | kit `Card.svelte:2,10`, `Gallery.svelte:2,15`                                                                                                                   | `Relation.resolve`                   |
| `isRelationResolved`   | `public.ts:8,29`; `thumbnail/hooks/set-document-thumbnail.server.ts:2,44`; `tests/basic/…/+page.svelte:2,25,44`                                                                                                                                                       | docs `014-relation.md:101-111`                                                                                                                                  | `Relation.resolve`, `Relation.isRef` |
| `isRelationUnresolved` | `public.ts:9,30`                                                                                                                                                                                                                                                      | docs `014-relation.md:113-123`                                                                                                                                  | `Relation.isRef`                     |
| `resolveRelation`      | `public.ts:10,36`; `tests/multilang/…/+page.svelte:2,13,30`                                                                                                                                                                                                           | kit `Hero.svelte:2,13`; docs `014-relation.md:125-133`                                                                                                          | `Relation.resolve`                   |
| `richTextJSONToText`   | `public.ts:13,37`; `operations/duplicate.ts:4,40`; `title/hooks/set-document-title.server.ts:2,20`; `panel/context/documentForm.svelte.ts:17,127`; `rich-text/component/Cell.svelte:2,6`; `tests/basic/…/+page.svelte:2,29,41`; `tests/multilang/…/+page.svelte:2,28` | kit `Gallery.svelte:2,17`, `rich-text/index.ts:3,12`; docs `015-rich-text.md:299-306`; docs site `Heading.svelte:4,13`, `search.ts:2,54`, `PageNav.svelte:4,35` | `RichText.toText`                    |

`relation/util.ts` goes with them, and with it `isRelationRef` and `resolveRelationRef`.

Stays as is: `RenderRichText`, `RichTextNodeRendererProps`, the `RelationValue` and `RelationRef`
types, `toRelationValue` (the panel's write side), and `populate` in `rimecms/panel`, which keeps
walking a whole value and resolving links' `url`.

## Internal rename: `Relation` → `RelationRow`

The type in `fields/relation/index.ts:99` is the adapter's row (`ownerId`, `path`, `position`). It
frees the name for the public class; it is not exported, so no changeset. `RelationItem` already
exists in `relation/value.ts`.

| File                                              | Lines                                                  |
| ------------------------------------------------- | ------------------------------------------------------ |
| `fields/relation/index.ts`                        | 99, and the comment of `BeforeOperationRelation` (113) |
| `core/adapter.ts`                                 | 4, 264, 265, 276                                       |
| `core/pipeline/build-document.server.ts`          | 5, 68                                                  |
| `core/pipeline/persist/relations/diff.server.ts`  | 3, 7, 8, 12, 17, 31, 32                                |
| `adapter-sqlite/relations.server.ts`              | 3, 157, 178, 179, 190                                  |
| `fields/relation/value.ts`                        | 2, 21, 23                                              |
| `fields/relation/component/RelationInline.svelte` | 17, 42, 81                                             |
| `fields/relation/component/Relation.svelte`       | 19, 45, 125                                            |

## Bugs fixed in place

Found by the same audit. Each is fixed in its own file; none depends on the tools above, except bug
6, which reads the missing refs with `Relation.resolve`.

| #   | Where                                                        | Today                                                                                                                                                                                                                                                                    | Fix                                                                                   |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | `relation/module.server.ts:36-53`, `extract.server.ts:56-73` | a document read at depth 1 and saved back has no `documentId`: it is dropped, and the stored relation is deleted                                                                                                                                                         | a document's `id` is read as its `documentId`                                         |
| 1b  | `shared/versions/hooks/handle-new-version.server.ts:216-217` | on a versioned collection, every `id` is stripped before validation, so the document above has lost its `id` before 1 can read it                                                                                                                                        | the relation values are reduced to their `documentId` before the strip                |
| 2   | `extract.server.ts:56-70`                                    | `[null]` under `?skipValidation` (field hooks skipped): `null.id`, a 500                                                                                                                                                                                                 | `null` elements skipped                                                               |
| 3   | `extract.server.ts:56-73`                                    | one ref sent outside an array: read as `[]`, the relation deleted                                                                                                                                                                                                        | read as one ref                                                                       |
| 4   | `set-default-values.server.ts:105-113`                       | `defaultValue(['a', 'b'])` stored in the read's order (`updatedAt desc`), so `[b, a]` when `b` changed last                                                                                                                                                              | positions follow the declared ids                                                     |
| 5   | `relation/index.ts` (`defaultValue`)                         | in the browser a default stays the bare id it was written as: the create form throws (`Relation.svelte:128`, `.map` on a string), a new block's image box shows empty or loads forever (`RelationInline.svelte:42-61`), a group preview shows "36 items" (`Cell.svelte`) | the field's default answers refs: `ids.map((id) => ({ relationTo, documentId: id }))` |
| 6   | `relation/component/Relation.svelte:125-128,153-156`         | a saved ref that no longer matches the field's `.query()` is not shown, and the next edit writes the value without it                                                                                                                                                    | the missing refs are read with `Relation.resolve(…).all()`                            |

## Also found

- **Docs wrong today:** `05-fields/014-relation.md:109` logs `doc.author.title` (a relation is an
  array: `doc.author[0].title`); `05-fields/01-blocks.md:60` shows a single relation as an object
  (the API answers an array); `fields/blocks/index.ts:235,289` and `01-blocks.md:174` say a
  render's relations are refs (a new block's default is a bare id until bug 5).
- **Kit:** `bin/lib/add.js:216-221` prints the `depth: 1` note for `card` only, not `gallery`
  (`add.spec.js:181` checks the substring `find({ depth: 1 })`).
- **Not in this plan:**
  - `adapter-sqlite/transform.server.ts:195-214`: `key.replace('Id', '')` replaces the first
    `Id`, so a slug like `videoIdeas` would read back wrong. Read, not run.
  - `thumbnail/hooks/set-document-thumbnail.server.ts`: one `findById` per document of a list at
    depth 0 (N+1), not a system read, so a reader refused the related collection gets the whole
    read refused.
  - `tests/multilang/routes/(front)/[[locale]]/about/+page.server.ts:7`: `locale` is never
    declared (hidden by `@ts-ignore`).
  - `rich-text/core/features/resource/resource.svelte:89` stores `_type` with the source's
    `?where…` query.
  - `core/locale/copy.server.ts`: a locale copy deletes and reinserts the target's rows. No data
    lost.
  - `core/prototype/area/definition.server.ts:45-58`: an area's first boot writes default ids
    without checking they exist.

## Steps

1. `WithRelationResolved<T, D = 1>` and the four read methods typed by `depth`; rename the
   `WithRelationPopulated` call sites. Type tests (`expectTypeOf`): depth 0, 1, 2, a `number`, a
   block's relation at depth 1.
2. `relation/fetch.ts`: `fetchDoc` and its cache, out of `populate.ts`; no request during server
   rendering.
3. `relation/relation.ts`: `Relation.isRef` and `Relation.resolve(value)` with `first()` and
   `all()`. `relation/relation.spec.ts` replaces `util.spec.ts`: every row of the table, `fetch`
   stubbed.
4. On `Relation`: `populate.ts`, `RelationInline.svelte`, the thumbnail hook. Delete
   `relation/util.ts`.
5. `RichText.toText`; move the rime call sites.
6. `Relation` type → `RelationRow`.
7. `public.ts`: export `Relation` and `RichText`; drop the five old names.
8. The test front pages; `fields/blocks/index.ts:235,289`.
9. Bugs 1 to 6, each in its file, with a spec for 1 to 4 (a versioned collection included).
10. Changesets, one per note:
    - `Breaking Change:` `isRelationPopulated`, `isRelationResolved`, `isRelationUnresolved` and
      `resolveRelation` are replaced by `Relation.resolve(value).first()`, `.all()` and
      `Relation.isRef(value)`, with a before/after.
    - `Breaking Change:` `richTextJSONToText` is `RichText.toText`.
    - `Breaking Change:` `WithRelationPopulated<T>` is `WithRelationResolved<T, D>`.
    - `Added:` `find`, `findById` and `findByIds` with a literal `depth` return the documents
      typed with their relations resolved to that depth, blocks and trees included.
    - `Fixed:` a relation fetched from a site page or a panel preview uses the API path, whatever
      the page's own path.
    - `Fixed:` a document read with its relations resolved and saved back keeps its relations.
    - `Fixed:` a relation sent as `[null]` with `?skipValidation`, or as one ref outside an array,
      no longer answers 500 or deletes the relation.
    - `Fixed:` a relation's list default is stored in the order it is written.
    - `Fixed:` in the panel, a relation's default shows as picked, in a create form, a new block
      and a group preview.
    - `Fixed:` in the panel, a related document that no longer matches the field's `query()` stays
      in the field.
11. `@rimecms`, after rime is released or packed:
    - the kit: `Hero`, `Card`, `Gallery`, `rich-text/index.ts`, `bin/lib/add.js`, and
      `_type: 'medias'` in the `card.svelte.spec.ts:9` and `gallery.svelte.spec.ts:8` fixtures,
      with `fetch` stubbed in their "not populated" cases;
    - the docs: the relation, blocks, rich-text, REST and rime API pages, the installation page,
      and the docs site's five files.

## Checks

- `bunx vitest run src/lib/fields src/lib/core src/lib/public-entries.spec.ts`: the `Relation`
  spec, the write-path spec, the depth type tests, and `rimecms/public` still reaching nothing of
  the panel.
- `bun run check`, `bun run lint` on the touched files.
- e2e, yours to run: `tests/basic`, `tests/multilang`, `tests/fields`, `tests/versions`. The tests
  that pin the API's raw shapes stay as they are.
- Kit: the `Hero` preview shows its image in the panel; a page's cards and gallery are in the
  server-rendered HTML.

## Open question

- `rimecms/util` has `upload` and `validate`, already namespaces
  (`upload.getMimeTypeFromExtension`). Turn them into classes too, or leave them?
