# Relation inline, and the upload picker

Two pieces, one picker. A block render draws its image and lets the editor pick another one in
place, and the relation field's own picker learns to show what is picked, to toggle, and to take
several at once.

**Measured at `48f11b35`.**

```bash
grep -n "addValue" src/lib/fields/relation/component/Relation.svelte           # 209, throws when the doc is not "available"
grep -n "isFull" src/lib/fields/relation/component/upload/Upload.svelte        # 65, the only thing that closes the picker
grep -n "onclick" src/lib/fields/relation/component/upload/Browse.svelte       # 147, add only, no selected state
grep -n "Command.Dialog" src/lib/fields/rich-text/core/features/upload/upload.svelte   # the rich text's own picker
grep -n "to('targets')" tests/fields/lib/+rime/pages.ts                        # 29, the image block
```

---

## 1. What is wrong with the picker today

`Browse.svelte` is the dialog `Upload.svelte` opens. It knows how to add and nothing else.

- **No mark.** It gets `addValue` and no selection, so a picked image looks like any other.
- **A second click throws.** `addValue` looks the doc up in `availableItems`, which leaves the
  selected ones out: `Can't find relation at <path>`.
- **Many never closes.** The only close is `if (isFull) open = false`, and a many field is full
  when every doc is picked.
- **One at a time.** Each image is a click, and nothing takes a row of them.

---

## 2. The picker, fixed

`Browse.svelte` takes the selection and one callback, and decides what a click means from `many`.

```ts
type Props = {
  open: boolean;
  config: BuiltCollection;
  many: boolean;
  /** Document ids, in the order they were picked. */
  selected: string[];
  /** The whole selection after a pick, and the docs the picker listed, to draw them at once. */
  onChange: (ids: string[], seen: UploadDoc[]) => void;
};
```

| field | a click on an image                  | the dialog                                            |
| ----- | ------------------------------------ | ----------------------------------------------------- |
| one   | picks it, in place of the one before | closes                                                |
| many  | picks it, or unpicks it when picked  | stays open; a footer says _3 selected_ and has _Done_ |

- **The mark.** A picked card gets `data-selected`, a ring and a check badge in its corner, the
  one `GridItem` draws in select mode, and its position in the selection: _1_, _2_, _3_.
- **A sweep.** Press on an image and move across the others: every image the pointer crosses
  takes the state the first one took, picked or unpicked, like painting checkboxes. The pointer is
  tracked with `pointermove` and `document.elementFromPoint`, so a touch works too: a touch
  captures the pointer, and `pointerenter` never fires on the other cards.

  ```ts
  let sweep: { add: boolean; seen: Set<string> } | null = null;

  function onPointerDown(event: PointerEvent, id: string) {
    if (!many) return;
    sweep = { add: !selected.includes(id), seen: new Set([id]) };
    apply(id);
  }

  function onPointerMove(event: PointerEvent) {
    if (!sweep) return;
    const card = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-id]');
    const id = card?.getAttribute('data-id');
    if (id && !sweep.seen.has(id)) {
      sweep.seen.add(id);
      apply(id);
    }
  }
  // pointerup on the window ends it; the click that follows a sweep is swallowed, a click from
  // the keyboard (event.detail === 0) toggles as usual.
  ```

- **Shift-click** picks the range between the last pick and this one, in grid order.
- **The field side.** `Relation.svelte` replaces `addValue` for the upload picker with `setValue(ids, seen)`:
  the selection in, the relation value out, no lookup in `availableItems`, so nothing throws. The
  field's list below keeps its order drag and its remove buttons.

The value the field writes moves to a helper, so the inline component writes the same shape:

```ts
// fields/relation/value.ts
export function toRelationValue(
  items: { documentId: string; id?: string; livePreview?: GenericDoc }[],
  args: { relationTo: string; path: string; locale?: string; live?: boolean }
): Omit<Relation, 'ownerId'>[] {
  // keeps `id` for a doc already related, sets `position` by order, `locale` when localized
}
```

---

## 3. `RelationInline`

A render draws the related docs its own way; `RelationInline` makes that drawing the place where
they are picked. Upload collections only: for a relation to pages or products, the render shows
what it likes and the inspector picks, as it does today.

```ts
// exported from rimecms/panel, like RichTextInline
type Props = {
  path: string; // `${path}.image`
  config: RelationFieldBuilder; // the block's field
  form: DocumentFormContext;
  /** What the render draws for the docs: resolved at depth 1, in order. */
  children: Snippet<[{ docs: UploadDoc[]; open: () => void }]>;
  /** Drawn while nothing is picked; a button by default. */
  empty?: Snippet<[{ open: () => void }]>;
};
```

In a render:

```svelte
<!-- renders/Image.svelte -->
<script lang="ts">
  import type { BlockRenderProps } from 'rimecms/fields';
  import { RelationInline } from 'rimecms/panel';
  const { path, fields, form }: BlockRenderProps = $props();
  const image = $derived(fields.find((field) => field.name === 'image') as RelationFieldBuilder);
</script>

<RelationInline path="{path}.image" config={image} {form}>
  {#snippet children({ docs })}
    <img class="site-image" src={docs[0].sizes.md} alt={docs[0].alt} />
  {/snippet}
</RelationInline>
```

The workflow, on the stage:

1. **Empty.** The component draws `empty`, a dashed box with _Choose an image_ by default. A click
   selects the block and opens the picker.
2. **One.** The render draws the image. A click on it selects the block, as any click on a
   render; a second click, on the selected block, opens the picker. Over the image, while the block
   is selected, a small _Replace_ and a _Remove_ in its corner, like the rich text's media.
3. **Many.** The render draws the list its way, a grid, a slider. While the block is selected, one
   _Edit images_ button over it opens the picker on the many mode of §2: the marks show what is
   there, a click adds or takes out, a sweep takes a row, _Done_ closes. Order is the pick order;
   reordering stays in the inspector, where the field's list drags.

What it does underneath:

- The value is `form.useField(path, config)`, the same field the inspector shows, so both follow
  each other.
- The docs: a pick hands `Browse`'s own docs over, so the render draws at once; a value that was
  there on load goes through `populate`, cached, and draws when the docs arrive.
- A pick writes `toRelationValue(ids, …)`, the shape `Relation.svelte` writes.
- Its buttons are `<button>`, which the stage's drag filter leaves alone, and they stop their click
  so the block's own click does not select it again underneath.

---

## 4. Fixture

`tests/fields/lib/+rime`:

```ts
// medias.ts, the basic suite's, one image size
export const Medias = Collection.create('medias', {
  label: { singular: 'Media', plural: 'Medias' },
  upload: { imageSizes: [{ name: 'md', width: 1024, out: ['webp'] }] },
  fields: [text('alt')],
  access: { read: () => true }
});

// pages.ts
const blockImage = block('image').fields(relation('image').to('medias')).render(Image);
const blockGallery = block('gallery').fields(relation('images').to('medias').many()).render(Gallery);
// sections: paragraph, image, keyFacts, grid, gallery
// a top-level field for the picker in the plain form:
relation('photos').to('medias').many(),
```

`keyFacts` keeps its relation to `targets`: that test is about depth, not uploads.

Tests that move with it:

- `blocks-tree.test.ts` posts image blocks with target ids: it creates two medias first, with
  `tests/basic/landscape.jpg` as base64, the way `basic/api.test.ts` does.
- `blocks-focus.test.ts`: the image block has a render now, not a placeholder; the palette has five
  types.

---

## 5. Tests

`tests/fields/relation-upload.test.ts`, on the fixture above:

- **The field, many.** Open the picker on `photos`: click two medias, both marked, the dialog
  still open; click the first again, unmarked; _Done_; the field lists one. No console error.
- **The sweep.** Press on the first media and move across the next two: three marked; press on a
  marked one and move across: unmarked.
- **The field, one.** On an image block's field in the inspector: a click picks and closes;
  another pick replaces it.
- **Inline, one.** Add an image block with ⌘K; the stage shows _Choose an image_; pick; the render's
  `img` has the media's `md` size; save; the API has the relation.
- **Inline, many.** A gallery block: _Edit images_, pick two, _Done_; the render draws two; the
  inspector's field lists the same two.

---

## 6. Order

1. Fixture: `medias`, the image block on it, the gallery block, `photos`; `blocks-tree` and
   `blocks-focus` follow.
2. §2: `toRelationValue`, `Browse` with selection, toggle, close rules, sweep, shift-click;
   `Relation.svelte` on `setValue`. The field test.
3. §3: `RelationInline`, `Image.svelte`, `Gallery.svelte`; the inline tests.

One changeset each: `Fixed:` for the picker, `Added:` for `RelationInline`.

---

## 7. Open

- The rich text's own media picker (`upload.svelte`, a `Command.Dialog` of filenames) could open
  `Browse` in its one mode instead, for the same grid and folders everywhere.
- Reordering many images inline: drag in the render is the render's markup, which the component
  does not own. The inspector's list does it; a `sortable` hook the render opts into could come later.
- A relation to a non-upload collection in `RelationInline`: refused with a console warning, or
  opening the default relation's picker. Refused, for now.
