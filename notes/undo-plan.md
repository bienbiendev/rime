# Undo in a document form

⌘Z takes back the last change to the document on screen, ⇧⌘Z puts it back. One history per form,
so a document opened over another one, a relation creating its own, has its own.

**Measured at `0bfde96a`.**

```bash
grep -n "doc = " src/lib/panel/context/documentForm.svelte.ts   # 148, 154, 185, 350, 650, 723
grep -n "history\|undo" src/lib/fields/rich-text/core/build-editor-config.ts
```

---

## 1. What is recorded

The document, whole, after every change the user makes. A panel document is a form's worth of
values; a snapshot of it is cheap beside the editing it took to make, and it makes undo exact:
a block moved across lists, a tree reordered, a relation picked, all come back with one write.

The write points, and what they mean for the history:

| `documentForm.svelte.ts`                              | is                               | recorded                                |
| ----------------------------------------------------- | -------------------------------- | --------------------------------------- |
| `setValue` (148)                                      | a field, a keystroke             | yes, coalesced                          |
| `useTree` `assignItemsToDoc` (185)                    | a tree operation                 | yes                                     |
| `blocks.apply` (350)                                  | a block operation                | yes                                     |
| `sync` (154)                                          | a value the server already holds | no, and the top of the stack follows it |
| the submit's `doc =` (650) and `mergeServerDoc` (723) | the server's row                 | no; the stack is dropped                |

```ts
// panel/context/history.svelte.ts
export type HistoryEntry<T> = { doc: T; label: string };

export function createHistory<T>(options: { limit?: number; coalesceMs?: number } = {}) {
  // past: the states before the current one, newest last. future: what an undo took back.
  // record(doc, label): pushes the *previous* doc, clears the future, drops the oldest past
  //   entry beyond `limit` (50).
  // A record whose label matches the last one, within `coalesceMs` (400), replaces it rather
  //   than pushing: a typed word is one undo, not eight.
  // undo() / redo(): returns the doc to write, or null.
  return { record, undo, redo, clear, get canUndo(), get canRedo() };
}
```

The label is what coalesces: `field:layout.title` for a keystroke, `blocks:insert` and the other
operations for the rest, each a step of its own.

---

## 2. In the form

```ts
const history = createHistory<T>();

function setValue(path: string, value: any) {
  history.record(snapshot(doc) as T, `field:${path}`);
  doc = setValueAtPath(path, doc, value);
  if (onDataChange) onDataChange({ path, value });
}

/** The document as it was one change ago, errors and the live pane with it. */
function undo() {
  const previous = history.undo(snapshot(doc) as T);
  if (previous) restore(previous);
}

function restore(next: T) {
  doc = next;
  errors.clear();
  if (onDataChange) onDataChange({ path: '', value: snapshot(doc) });
}
```

- `errors.clear()`: the paths that carried an error may not exist any more. Validation runs on
  save, and on the next keystroke in a field.
- `onDataChange` with an empty path is the live pane's full-document seed
  (`live.svelte.ts` `handlePanelUpdate`), so the front page follows an undo.
- A save clears the history: what is on the server is the new floor.
- `form.undo`, `form.redo`, `form.canUndo`, `form.canRedo` on the context.

---

## 3. The keys

`Document.svelte`, next to its ⌘S, and nowhere else: the scope of the form that mounted it.

```ts
useCommands(() => [
  {
    id: 'document.undo',
    label: t__('common.undo'),
    group: t__('common.document'),
    icon: Undo2,
    keys: 'mod+z',
    when: () => form.canUndo,
    run: form.undo
  },
  {
    id: 'document.redo',
    label: t__('common.redo'),
    group: t__('common.document'),
    icon: Redo2,
    keys: 'mod+shift+z',
    when: () => form.canRedo,
    run: form.redo
  }
]);
```

**Two documents.** A nested document (a relation creating one, `Document.svelte` with
`nestedLevel > 0`) sets its own form context and its own scope. The commands stack gives the key
to the innermost scope that claims it, so ⌘Z in the dialog is the dialog's document, and the one
underneath keeps its own history untouched. Nothing to arbitrate.

**A field that has its own.** `inField` stays off, so while an input, a textarea or a rich text
has the keyboard, ⌘Z is the browser's or TipTap's. Undoing a rich text is the editor's business;
the form's history takes the paragraph back only once the editor has lost the focus. The
`blocks.apply` steps are not typed in a field, so focus mode undoes as expected.

---

## 4. Tests

**Unit**, `panel/context/history.spec.ts`, on the pure store: a record then an undo returns the
previous state; two records with the same label inside the window are one step; past the window
they are two; a record after an undo drops the future; the limit drops the oldest.

**E2e**, `tests/fields/commands.test.ts`: type in a text field, ⌘Z, the field holds its former
value and the form is clean again; in focus mode add a block, ⌘Z, the layers are back to three
rows, ⇧⌘Z and it is four again; in a rich text, ⌘Z is the editor's, the other fields do not move.

---

## 5. Open

- A change made by a field's `onChange` hook (a slug following a title) is one `setValue` inside
  another: the first records, the second coalesces onto it only if the labels match, which they
  do not. Two undos for one keystroke. Either the hook's writes join the label of the write that
  triggered them, or `setValue` records once per task with `queueMicrotask`.
- The auto-save fires on an undo like on any change. That is right, but a document that
  auto-saves has a server row behind every step, and the history is still the client's alone.
- Redo after a save: the stack is dropped, so there is none. Say so, or keep the future across a
  save and let it write over the server's row.
