# Blocks focus mode: plan

The plan behind `notes/builder.md`. One rule decides every point below: **the field is the
builder**. One form state, one set of block operations, several views on it. The inline field
stays as quiet as it is today; the tools live in a focus mode of that field.

**Measured at `41fe42e4`.** The greps are the contract, re-run them.

```bash
grep -n "useBlocks\|rebuildPaths" src/lib/panel/context/documentForm.svelte.ts   # 291, 132
grep -n "group: path" src/lib/fields/blocks/component/Blocks.svelte              # one list, one group
grep -rn "Command.Dialog" src/lib/fields/blocks/component/AddBlockButton.svelte  # the picker
grep -n "getFieldListAtPath" src/lib/panel/components/sections/live/LiveEditPanel.svelte
```

---

## 0. Vocabulary

| word        | is                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------- |
| inline view | the blocks field as rendered in the document form today: collapsed cards, `+`             |
| focus       | the same field, full page, opened from the inline view                                    |
| layers      | the tree of blocks of that field, nested `blocks` fields included                         |
| stage       | the middle region: the selected block's fields, or the renders when blocks have one       |
| palette     | the block types to insert                                                                 |
| inspector   | the selected block's fields, when the stage shows renders                                 |
| render      | an optional component a block declares, drawn in the stage                                |
| selection   | the one block (or several) the layers, the palette and the shortcuts act on               |
| list path   | the path of a blocks array, without `:type`: `layout.sections`, `layout.sections.0.items` |

Nesting is not a new thing. A block that holds a `blocks` field holds a list; `rebuildPaths`
(`documentForm.svelte.ts:132`) already rewrites `path` and `position` down that subtree.

---

## 1. Operations

`useBlocks(path)` knows one list. The focus mode moves blocks between lists, so the operations
take paths. Same internals: `getBlocks`, `assignBlocksToDoc`, `rebuildPaths`,
`errors.deleteAllThatStartWith`.

```ts
type At = { list: string; index: number }; // index: insert before it; list.length appends

form.blocks.insert(at: At, block: { type: string } & Dic): string;   // returns the temp id
form.blocks.remove(path: string): void;
form.blocks.duplicate(path: string): string;
form.blocks.move(from: string, to: At): void;
form.blocks.copy(path: string): Promise<void>;                        // clipboard
form.blocks.paste(at: At): Promise<string | null>;                    // null when refused
form.blocks.list(list: string): GenericBlock[];
form.blocks.accepts(list: string, type: string): boolean;             // the list's block set
```

- `move` across lists is splice out, splice in, `assignBlocksToDoc` on both lists. Errors under
  the old path are deleted; validation on save fills the new ones.
- `accepts` reads the list's `BlocksBuilder` through `getFieldAtPath(list, config.fields)` and its
  `get.blocks` names. It is what greys a drop target out and what `paste` checks.
- The clipboard carries `{ rime: 'block', type, block }` as JSON. `paste` resets ids on the subtree
  with the `resetIds` now inside `duplicateBlock`, pulled out to a function.
- `useBlocks(path)` stays for the inline component, implemented over these.
- Selection is not form state. It lives in the focus context (§3).

Both the inline cards and every focus region call these and nothing else.

---

## 2. Inline view

Unchanged, plus one entry:

- a _Focus_ button in the field header, next to _Collapse all_ (`Blocks.svelte`);
- double-click on a card header opens focus with that block selected.

`BlockActions` keeps duplicate and delete. No layers, no palette, no shortcuts inline.

---

## 3. Focus shell

**Mount.** `Document.svelte` renders `BlocksFocus` in place of `RenderFields` while a focus path is
set. `Header` stays: title, status, save, locale. The same `form` is passed down; nothing else.

**Address.** `pushState` with `?focus=layout.sections`, so Escape, the close button and the back
button all close it, and the address is shareable. `Document.svelte` reads it on load and opens
focus straight away. `documentForm` already uses `replaceState` for `versionId`; the two params
coexist.

**Context.** `focus.svelte.ts`:

```ts
{
  path: string;                 // the list path focus was opened on
  selection: string[];          // block paths, first is the current one
  select(path, { extend }): void;
  close(): void;
}
```

**Regions.**

```
┌ La Chambre Bleue › Layout › Sections FR              Save   ✕ ┐
├───────────────┬──────────────────────────────┬────────────────┤
│ Layers        │ Stage                        │ Palette        │
└───────────────┴──────────────────────────────┴────────────────┘
```

- `BlocksLayers.svelte`: one sortable per list, all in group `blocks`, with
  `put: (to, from, el) => form.blocks.accepts(to.el.dataset.list, el.dataset.type)`. `onEnd` calls
  `form.blocks.move`. Rows show the block icon, `renderTitle`, a dot when `form.errors` has an
  entry under the block's path. Click selects, shift-click extends.
- Stage: `RenderFields` over `getFieldListAtPath(selectedPath, config.fields)`, the call
  `LiveEditPanel` already makes.
- `BlockPalette.svelte`: the items `AddBlockButton` builds today (icon, label, description,
  `image`). Click inserts after the current selection and selects the new block. Rows are a
  sortable source with `pull: 'clone'`, `put: false`, so a type can be dragged into layers.
- Selection rules: after `insert` select the new block; after `remove` select the next row, else
  the previous; after `move` keep the moved block selected.

**Reuse.** `useSortable` (`panel/util/Sortable.ts`) as is. Its `onEnd` restores the DOM before the
state moves; the layers rely on that the same way the cards do.

---

## 4. Keyboard and command palette

Active while focus is open. Single keys apply only when no input, textarea or contenteditable has
the browser focus; ⌘ combinations always, except ⌘K when a rich-text editor has the focus (§10).

| key   | does                                                |
| ----- | --------------------------------------------------- |
| ↑ ↓   | select previous / next row                          |
| → ←   | expand / collapse a row with children               |
| ⌥↑ ⌥↓ | move the selection one position                     |
| ⌘D    | duplicate                                           |
| ⌫     | remove, after a confirm when the block has children |
| ⌘C ⌘V | copy / paste after the selection                    |
| /     | command palette, filtered to _Add_                  |
| ⌘K    | command palette                                     |
| ⌘S    | save (exists in `Document.svelte`)                  |
| Esc   | close the palette, else close focus                 |

`BlocksCommand.svelte` reuses `Command.Dialog`. Three groups, one filter over all of them:

- _Add_: block types, insert after the selection;
- _Block_: duplicate, move up, move down, move into…, remove, collapse all, expand all;
- _Go to_: the layers rows by title.

---

## 5. Render

A block may declare a component drawn in the stage.

```ts
block('title').render(TitleRender);

// BlocksFieldBlock
render?: Component<{ path: string; config: BlocksFieldBlock; form: DocumentFormContext }>;
```

- `compile()` passes it through like `icon`. Components already travel in the config on both
  sides; nothing to add to the sanitizer.
- With at least one render in the field, the stage becomes the stack of renders, the selected one
  outlined, click to select. The fields move to an inspector column on the right; the palette
  becomes the ⌘K palette. A block without a render shows a placeholder card: icon and title.
- A render reads values with `form.getValue(path)`. For an editable spot it mounts a panel field
  with the same `path` and `form`, the rich-text component included:

  ```svelte
  <h2 class="site-title">{form.getValue(`${path}.title`)}</h2>
  <RenderFields fields={[fieldOf(config, 'text')]} {path} {form} />
  ```

  `fieldOf` is a small lookup on the block's fields; `RenderFields` is exported from
  `rimecms/panel` for this.

- Relations in a render are `{ relationTo, documentId }`. The `populate` function in
  `panel/context/live.svelte.ts` resolves them at depth 1; move it to `panel/util/populate.ts`,
  cache by id, and let renders call it.
- Tokens reach the panel through `panel.css`. Document it in the render section, nothing to build.

---

## 6. Live edit reuse

`LiveEditPanel` renders, for a blocks `fieldPath`, `BlocksLayers` above the selected block's fields
instead of the flat field list. Same components, same operations over the pane's own form.

- Iframe click on a block → `activatePanel` with the block path (exists) → the layers select it.
- Layers select → `activePanel` posted to the iframe (exists) → the wrapper outlines it.
- Later: the `LiveEdit` wrapper on a list renders a control bar per child in a shadow root
  (add after, move up, move down, remove) and posts intents; the pane applies them through
  `form.blocks`. The page never writes; the parent does, with the staff session.

---

## 7. Config surface

```ts
blocks('sections', [Diaporama, Title, ImagesGrid]); // inline cards + Focus button
blocks('sections', [...]).summary();                // inline: "3 sections · Edit", Edit opens focus
block('title').render(TitleRender);                 // drawn in the stage
```

Nothing else. No `slot`: nesting is a `blocks` field in a block. No `.layout('standalone')`: focus
is that mode, opened per field.

---

## 8. Tests

**Unit, vitest, on a plain document** (`documentForm` operations extracted to a pure module so
they run without Svelte):

- `move` across lists rewrites `path` and `position` on the moved block and its descendants;
- `remove` drops the errors under the path;
- `paste` refuses a type the list does not accept and resets every id on the subtree;
- `accepts` follows the list's block set through a nested list.

**E2e, `tests/fields`,** the `pages` fixture has `sections` with `paragraph`, `image` and
`keyFacts`, new file `blocks-focus.test.ts`:

- the Focus button opens focus, the address carries `?focus=layout.sections`, Escape closes it
  and the pending change is still in the form;
- the palette inserts after the selection and the new block is selected;
- a drag in the layers reorders, a drag into a nested list moves, a refused type stays put;
- `/` then Enter adds the first type; ⌘D duplicates; ⌫ removes;
- save persists the order and the nesting, read back through the API.

A live-edit test comes with §6, on `tests/basic/pages.test.ts` where live is covered.

---

## 9. Order

| stage | content                                                      | size |
| ----- | ------------------------------------------------------------ | ---- |
| A     | §1 operations, unit tests, inline cards moved onto them      | S    |
| B     | §3 shell, layers, stage fields, palette; §4 keys and ⌘K; e2e | L    |
| C     | §5 render, inspector, populate, docs                         | M    |
| D     | §6 live pane on the same components                          | M    |
| E     | `.summary()`                                                 | S    |

Each stage ships on its own, one `Added:` changeset per stage. B does not wait for the traversal
refactor in `notes/decoupling-field-traversal.md`: `accepts` and the stage both go through the
existing `getFieldAtPath` / `getFieldListAtPath`, and move onto the new contract when it lands.

---

## 10. Open questions

- ⌘K: the rich-text link feature may bind it. Check `fields/rich-text/core/features/link`; if it
  does, focus defers to the editor while it has the browser focus, or takes ⌘⇧K.
- Multi-select: move and remove only, or duplicate and copy too.
- A form that is read-only (lock held by someone else): layers navigable, operations disabled,
  palette hidden.
- Narrow screens: layers and palette as drawers over the stage.
- `summary` on a localized field: where the locale badge and _copy from default locale_ go.

## 11. Out of scope

`slot`; an overlay computed from the parent over the iframe; an editor injected into the front
page (`feature/live-rich-text`); patterns stored in the database. Presets can come later as
`blocks(...).presets([...])` in config and copy/paste in the meantime.
