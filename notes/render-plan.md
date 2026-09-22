# Blocks focus mode, stage C: render

Continues `notes/builder-plan.md` at §5. Stages A and B are in (`form.blocks`, the focus shell,
layers, stage, palette, ⌘K, keys, e2e). Nothing of §5 exists yet.

```bash
grep -n "render" src/lib/fields/blocks/index.ts                     # nothing
grep -n "populate" src/lib/panel/context/live.svelte.ts             # 83, the closure to move
grep -n "RenderFields" src/lib/panel/index.ts                       # not exported
```

---

## 1. The render

A block type declares a component drawn in the stage. It is a panel component: it gets the
block value, and enough to mount panel fields inside it.

```ts
// fields/blocks/index.ts
block('hero').fields(text('title'), richText('text')).render(HeroRender);

export type BlockRenderProps = {
  /** The block value, relations as `{ relationTo, documentId }`. */
  block: GenericBlock;
  /** `layout.sections.0` */
  path: string;
  /** The block's field builders, for `RenderFields`. */
  fields: FieldBuilder<Field>[];
  form: DocumentFormContext;
  /** The block's nested lists, each block in its own selectable wrapper. `children('items')` for one list. */
  children?: Snippet<[name?: string]>;
};

// BlockBuilder, after renderTitle()
render(component: Component<BlockRenderProps>) {
  this.block.render = component;
  return this;
}

// BlocksFieldBlock
render?: Component<BlockRenderProps>;
```

The panel reads live builders (`focus.svelte.ts` `configOf`), so `row.config.render` is the
component; nothing goes through `compile()`. `BlockBuilder` becomes `export class`.
`BlockRenderProps` is exported next to `BlocksFieldBlock` in `fields/types.ts`; `RenderFields`
and `populate` are exported from `rimecms/panel`.

A render on the consumer side, reusing a site component for the display and a panel field for
one spot:

```svelte
<!-- src/lib/+rime/renders/HeroRender.svelte -->
<script lang="ts">
  import type { BlockRenderProps } from 'rimecms/fields';
  import { populate, RenderFields } from 'rimecms/panel';
  import Hero from '$lib/site/blocks/Hero.svelte';

  const { block, path, fields, form }: BlockRenderProps = $props();
</script>

{#await populate(block) then hero}
  <Hero {...hero} />
{/await}
<RenderFields fields={fields.filter((f) => f.name === 'text')} {path} {form} />
```

A block holding a `blocks` field says where its blocks go:

```svelte
<!-- src/lib/+rime/renders/GridRender.svelte -->
<script lang="ts">
  import type { BlockRenderProps } from 'rimecms/fields';
  const { block, children }: BlockRenderProps = $props();
</script>

<section class="site-grid">
  <h2>{block.title}</h2>
  <div class="site-grid__items">{@render children?.()}</div>
</section>
```

---

## 2. Populate

The `populate` closure of `live.svelte.ts:83-160` moves to `panel/util/populate.ts` as is, with a
cache. Same walk: `livePreview` short-circuit, relations and resource links fetched at depth 1,
arrays and objects recursed, a substituted doc not recursed into.

```ts
// panel/util/populate.ts
const cache = new Map<string, Promise<Dic | null>>();

/** One request per document for the page's life. */
function fetchDoc(slug: string, id: string) {
  const key = `${slug}/${id}`;
  if (!cache.has(key)) {
    const url = `${API_PREFIX}/${toKebabCase(slug)}/${id}?depth=1`;
    cache.set(
      key,
      fetch(url)
        .then((r) => r.json())
        .then((r) => r.doc ?? null)
        .catch(() => null)
    );
  }
  return cache.get(key)!;
}

/** Relations and resource links resolved at depth 1, the shape the API answers with. */
export async function populate<T>(value: T): Promise<T> {
  /* the moved body, over fetchDoc */
}

populate.clear = () => cache.clear();
```

- `API_PREFIX` from `core/routes/constants.ts`, not `apiUrl` (imports `$app/state`, which the
  node vitest project cannot load).
- `live.svelte.ts` imports it. `BlocksFocus` calls `populate.clear()` on mount, so a focus
  session starts fresh.

Unit test `panel/util/populate.spec.ts` with a fake `fetch`: two identical refs → one request;
`livePreview` → none; nested arrays and objects; a link gets `url`; a failed request → the ref
comes back and is not retried.

---

## 3. The stage with renders

The open list decides the layout: when its block set has at least one `render`, the stage is the
stack of renders and the fields move to an inspector on the right. The palette column goes;
⌘K and `/` add.

```
┌ La Chambre Bleue › Layout › Sections FR              Save   ✕ ┐
├───────────────┬──────────────────────────────┬────────────────┤
│ Layers        │ Renders                      │ Inspector      │
└───────────────┴──────────────────────────────┴────────────────┘
```

```ts
// focus.svelte.ts, in the store
get hasRenders() {
  return !!path && !!builderOf(path)?.get.blocks.some((block) => block.get.render);
}
```

```svelte
<!-- BlocksFocus.svelte -->
<div class="rz-blocks-focus" data-layout={focus.hasRenders ? 'renders' : 'fields'} …>
  …
  <div class="rz-blocks-focus__body">
    <aside class="rz-blocks-focus__layers"><Layers {form} /></aside>
    {#if focus.hasRenders}
      <section class="rz-blocks-focus__renders"><Renders {form} /></section>
      <aside class="rz-blocks-focus__inspector">
        {#if focus.current}<Stage {form} onRemove={requestRemove} />{:else}<Palette {form} />{/if}
      </aside>
    {:else}
      <section class="rz-blocks-focus__stage"><Stage {form} onRemove={requestRemove} /></section>
      {#if !focus.locked}<aside class="rz-blocks-focus__palette"><Palette {form} /></aside>{/if}
    {/if}
  </div>
```

```css
[data-layout='renders'] .rz-blocks-focus__body {
  grid-template-columns: minmax(14rem, 1fr) minmax(0, 3fr) minmax(22rem, 1.5fr);
}
@media (max-width: 60rem) {
  /* the inspector stays, the renders column goes */
}
```

The inspector is `Stage` for the selected block; nothing selected, it is the `Palette`, listing
the types the open list takes. A click on the stage beside the blocks selects the root.

The palette rows drag: a sortable source with `pull: 'clone'`, the clone removed on drop. The layers
lists and every `.rz-renders` list take the drop (`put` checks `form.blocks.accepts`) and call
`focus.insertType(type, { list, index })` in `onAdd`. A `.rz-renders` list never drags its own
blocks (`filter` on the items, `preventOnFilter: false`), so a field inside a render keeps the
mouse.

**`Renders.svelte`**, one list, recursive like `LayersList`: one wrapper per block. A block's
nested lists are a `children` snippet handed to its render, which puts `{@render children()}`
where they go; each nested block gets its own wrapper inside. A block without a render is a
placeholder card, icon and title, with its `children` below. A click on a wrapper selects that
row and stops there; the render's own links and buttons do nothing.

```svelte
<script lang="ts">
  const { form, list }: { form: DocumentFormContext; list: string } = $props();
  const focus = getBlocksFocusContext()!;
  const rows = $derived(focus.rowsOf(list));

  /** A click selects the row and stops there; a link inside a render does not navigate. */
  function select(event: MouseEvent, rowPath: string) {
    event.stopPropagation();
    if ((event.target as Element).closest('a[href]')) event.preventDefault();
    focus.select(rowPath, { extend: event.shiftKey });
  }
</script>

<div class="rz-renders" data-list={list}>
  {#each rows as row (row.block.id)}
    {@const config = row.config}
    {#snippet children(name?: string)}
      {#each row.children.filter((child) => !name || child.builder.name === name) as child (child.list)}
        <Renders {form} list={child.list} />
      {/each}
    {/snippet}
    <div
      class="rz-renders__item"
      data-path={row.path}
      data-type={row.block.type}
      data-selected={focus.isSelected(row.path) || undefined}
      role="button"
      tabindex="0"
      onclick={(event) => select(event, row.path)}
    >
      {#if config?.render}
        {@const Render = config.render}
        <svelte:boundary>
          <Render block={row.block} path={row.path} fields={config.fields} {form} {children} />
          {#snippet failed(error)}<RenderPlaceholder {row} {error} {children} />{/snippet}
        </svelte:boundary>
      {:else}
        <RenderPlaceholder {row} {children} />
      {/if}
    </div>
  {:else}
    <p class="rz-renders__empty">{t__('fields.no_blocks_yet_render')}</p>
  {/each}
</div>
```

`BlocksFocus` mounts it with `list={focus.path}`.

```svelte
<!-- RenderPlaceholder.svelte -->
<script lang="ts">
  const {
    row,
    error,
    children
  }: { row: LayerRow; error?: unknown; children?: Snippet<[name?: string]> } = $props();
  const Icon = $derived(row.config?.icon ?? ToyBrick);
</script>

<div class="rz-render-placeholder">
  <p class="rz-render-placeholder__title">
    <Icon size={14} />
    <span>{row.title}</span>
    {#if error}<span class="rz-render-placeholder__error">{t__('fields.render_failed')}</span>{/if}
  </p>
  {@render children?.()}
</div>
```

Outline on `.rz-renders__item[data-selected]`.

---

## 4. Styling

Nothing to build. The render is a Svelte component in the panel's DOM: its `<style>` block
applies as in any component, and the panel's tokens are there. A render that wants the site's
stylesheet brings it in its own way: `@import` in its `<style>`, `@scope`, `:global`.

Injecting CSS variables into the panel is another job.

---

## 5. Tests

`tests/fields`, on the `pages` fixture.

```svelte
<!-- tests/fields/lib/+rime/renders/Paragraph.svelte -->
<script lang="ts">
  import type { BlockRenderProps } from '$lib/fields/types.js';
  import { richTextJSONToText } from '$lib/fields/rich-text/client.js';
  const { block }: BlockRenderProps = $props();
</script>

<p class="site-paragraph">{richTextJSONToText(block.text ?? undefined)}</p>

<style>
  .site-paragraph {
    color: rgb(200, 30, 30);
  }
</style>
```

```ts
// pages.ts
const blockParagraph = block('paragraph').fields(richText('text')).render(Paragraph);
```

`blocks-focus.test.ts`: `paragraph` is in every list, so the palette column is gone in all of
them; the two `.rz-palette__item` clicks (lines 81, 195) become an `addViaCommand(page,
/Add\s*Image/)` helper over ⌘K. New tests:

- the stack shows "Alpha" and "Beta" in `.rz-renders__item[data-type="paragraph"] .site-paragraph`,
  and the grid row is a placeholder with its title, holding "Inner" in a nested wrapper;
- a click on a render selects the layers row and the wrapper gets `data-selected`;
- typing in the inspector's `.ProseMirror` updates the render;
- `.site-paragraph` has `color: rgb(200, 30, 30)`;
- `?focus=sections` reopens onto the stack.

Run: `bunx vitest run src/lib/panel/util`, `bun run check`, `bun run rime:use fields` and read
`src/lib/+rime.generated/rime.config.ts` (`Paragraph.svelte` imported verbatim).
`bun run test:fields` is yours.

---

## 6. Ship

- i18n `en`/`fr` `fields.js`: `render_failed`, `no_blocks_yet_render` (the existing one says
  "from the right").
- `notes/builder-plan.md` §5 becomes a pointer to this file; §9 row C reworded.
- `.changeset/blocks-render.md`, `'rimecms': minor`, one bullet:

  > Added: `block(...).render(Component)` draws the block on the stage of focus mode. The
  > component gets `block`, `path`, `fields` and `form`, so it can show the value, populate its
  > relations with `populate` from `rimecms/panel`, and mount panel fields with `RenderFields`.
  > With a render in the list, the stage becomes the stack of renders, click to select, and the
  > fields move to an inspector on the right. Relation lookups of the live store are cached for
  > the page's life.

---

## 7. Later

- CSS variables injected into the panel for the renders.
- The site's stylesheet scoped to the stage by the panel (`@scope`, a shadow root), if a
  render's own `<style>` turns out not to be enough.

---

## 8. Rich text in place

A render edits its text where it draws it: the editor's controls over the text, no fieldset, no
label. `feature/live-rich-text` (`d74e0e4d`) has the split; the iframe parts of it stay there.

**`RichTextEditorCore.svelte`**, `fields/rich-text/core/`: the editor, the bubble menu, the drag
handle and the suggestion, over a value and an `onUpdate`. `RichText.svelte` keeps the fieldset,
the label, the error and the hint, and mounts the core.

```ts
type Props = {
  path: string;
  features?: RichTextFeature[];
  value?: JSONContent;
  editable?: boolean;
  class?: string;
  onUpdate?: (json: JSONContent) => void;
};
```

The core re-applies `value` when it changes outside the editor and differs from its content,
with `emitUpdate: false`: the editor's own updates come back equal and change nothing. Two
editors on one path follow each other. (Already in `RichText.svelte` since `fa9bc2cd`; it moves
into the core.)

Not taken from the branch: `stripNonFlowNodeViews`, `disablePortals`, `RenderRichTextLive`. They
serve the front page in an iframe, §6 of `builder-plan.md`.

**`RichTextInline.svelte`**, exported from `rimecms/panel`: the core bound to the form, with the
props every field component takes, `path`, `config`, `form`.

```svelte
<script lang="ts">
  type Props = {
    path: string;
    config: RichTextFieldBuilder;
    form: DocumentFormContext;
    class?: string;
  };
  const { path, config, form, class: className }: Props = $props();
  const field = $derived(form.useField<JSONContent>(path, config));
</script>

<RichTextEditorCore
  {path}
  features={config.get.features}
  value={field.value}
  editable={field.editable}
  class={className}
  onUpdate={(json) => (field.value = json)}
/>
```

In a render:

```svelte
<script lang="ts">
  import type { BlockRenderProps } from 'rimecms/fields';
  import { RichTextInline } from 'rimecms/panel';
  const { path, fields, form }: BlockRenderProps = $props();
  const text = $derived(fields.find((field) => field.name === 'text') as RichTextFieldBuilder);
</script>

<RichTextInline path="{path}.text" config={text} {form} class="site-paragraph" />
```

The fixture's `Paragraph.svelte` moves onto it; the e2e keeps its assertions, on
`.site-paragraph .ProseMirror`.

Two stylesheets. `styles/editor.css`, in the core, is what every editor draws: the states, the
placeholder, and the text, each choice behind a plain variable with the panel's default as
fallback: `--font-text`, `--font-heading`, `--text-size`, `--font-size`, `--font-weight`,
`--line-height`, `--margin-bottom`, `--list-indent`, `--quote-border`, `--quote-indent`. Each
element reads its own, so a value set on the editor reaches every element, one set on an
element stays there. The bubble menu and the drag handle
carry their own. `styles/field.css`, in the field, is the boxes under `.rz-field-rich-text`: one
per node, room for the drag handle, a text size that follows the page, no gap.

The editor's ⌘K belongs to `notes/commands-plan.md`: one palette, the editor's items a group of it.
