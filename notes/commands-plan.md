# Commands: one key, one palette, a stack of scopes

Every keyboard shortcut of the panel goes through one dispatcher, and ⌘K opens one palette that
lists what can be done where the user is. A component says what it offers; it never listens to
the keyboard itself.

**Measured at `fa9bc2cd`.**

```bash
grep -rn "svelte:window onkeydown\|addEventListener('keydown'" src/lib/panel src/lib/fields
#   Document.svelte:314        ⌘S save
#   FolderEdit.svelte:51       ⌘S save, a copy
#   LiveFloatingUI.svelte:84   ⌘S save, a copy
#   BlocksFocus.svelte:117     ⌘K, Esc, ⌘D, ⌘C, ⌘V, ↑ ↓ ⌥↑ ⌥↓ → ← ⌫
#   suggestion.svelte:44       ⌘K while a rich-text editor has the focus, a document listener
#   link-selector.svelte:178   Esc
```

What goes wrong today: ⌘K in a rich-text editor inside focus mode opens two palettes, the
editor's and the blocks', and the arrows go to neither. Every ⌘S is a copy. A shortcut of a
field and a shortcut of the page cannot see each other.

---

## 1. Vocabulary

| word       | is                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| command    | one thing the user can do: a label, a group, optional keys, a `run`                 |
| scope      | the commands a mounted component offers, for its lifetime                           |
| stack      | the mounted scopes, the innermost last: root, document, focus, editor               |
| dispatcher | the one `keydown` listener, on the window, walking the stack from the innermost     |
| palette    | the one `Command.Dialog`, listing the stack's commands, grouped, innermost first    |
| typing     | the keyboard is a field's: input, textarea, select, contenteditable, `.ProseMirror` |

---

## 2. A command

```ts
// panel/context/commands.svelte.ts
export type Command = {
  /** `document.save`, `blocks.duplicate`, `text.bold` */
  id: string;
  label: string;
  /** The palette's heading: `Document`, `Block`, `Add`, `Go to`, `Text` */
  group?: string;
  /** On the palette line, before the label. */
  icon?: Component<IconProps>;
  /** `mod+s`, `mod+shift+p`, `alt+arrowup`, `backspace`, `/`. `mod` is ⌘ on a Mac, Ctrl elsewhere. */
  keys?: string;
  /** Fires while a field has the keyboard. Off, the field keeps the key. */
  inField?: boolean;
  /** Keys only, not a palette line: the arrows. */
  hidden?: boolean;
  /** Offered right now. A command that is not is skipped, keys and palette alike. */
  when?: () => boolean;
  /** From a key, the event; from the palette, nothing. */
  run: (event?: KeyboardEvent) => void | Promise<void>;
};
```

A component offers a scope with a getter, so the list follows its state:

```ts
useCommands(() => [
  {
    id: 'document.save',
    label: t__('common.save'),
    group: 'Document',
    keys: 'mod+s',
    inField: true,
    when: () => form.canSubmit,
    run: () => submit()
  }
]);
```

`useCommands` registers on mount and unregisters on destroy, in an `$effect`. The stack is the
registration order, which is the mount order, which is the nesting.

---

## 3. The dispatcher

```ts
// panel/util/keys.ts, pure
export type Keys = { mod: boolean; shift: boolean; alt: boolean; key: string };
export const parseKeys = (keys: string): Keys => …;          // 'alt+arrowup' -> { alt: true, key: 'arrowup' }
export const matches = (event: KeyboardEvent, keys: Keys) =>
  keys.mod === (event.metaKey || event.ctrlKey) &&
  keys.shift === event.shiftKey &&
  keys.alt === event.altKey &&
  keys.key === event.key.toLowerCase();
export const formatKeys = (keys: string, mac: boolean) => …;  // 'mod+s' -> '⌘S' | 'Ctrl+S'
export const isTyping = (event: Event) => …;                  // over event.composedPath()[0]
```

```ts
// panel/context/commands.svelte.ts, in the root
function dispatch(event: KeyboardEvent) {
  const typing = isTyping(event);
  for (const scope of scopes.toReversed()) {
    for (const command of scope.get()) {
      if (!command.keys || !matches(event, parseKeys(command.keys))) continue;
      if (typing && !command.inField) continue;
      if (command.when && !command.when()) continue;
      event.preventDefault();
      command.run(event);
      return;
    }
  }
}
```

One listener, `<svelte:window onkeydown={commands.dispatch} />` in `Root.svelte`. The innermost
scope wins a key; a scope further out never sees it. Nothing else in the panel listens to the
keyboard: the editor's own keymap (TipTap's ⌘B, Enter, Tab) is the editor's, under the
dispatcher, and it keeps it because the dispatcher only takes what a command claims.

---

## 4. The palette

`panel/components/sections/commands/CommandPalette.svelte`, mounted once in `Root.svelte`. The
root scope claims ⌘K, `inField: true`: ⌘K opens it from anywhere, a rich-text editor included.
Escape closes it, and nothing else, because a `Command.Dialog` open is a dialog open.

```svelte
<Command.Dialog bind:open={palette.open} bind:value={palette.query}>
  <Command.Input placeholder={t__('common.search')} />
  <Command.List>
    <Command.Empty>{t__('common.nothing_found')}</Command.Empty>
    {#each groups as group (group.name)}
      <Command.Group heading={group.name}>
        {#each group.commands as command (command.id)}
          <Command.Item value="{group.name} {command.label}" onSelect={() => run(command)}>
            {#if command.icon}<command.icon size={13} />{/if}
            <span class="rz-command__label">{command.label}</span>
            {#if command.keys}<kbd>{formatKeys(command.keys, mac)}</kbd>{/if}
          </Command.Item>
        {/each}
      </Command.Group>
    {/each}
  </Command.List>
</Command.Dialog>
```

`groups` is the stack from the innermost scope out, the visible commands whose `when()` holds,
grouped by `group` in order of first appearance. `run` closes the dialog, then runs: the dialog
gives the focus back to where it was, so an editor command finds its selection where it left
it.

`palette.open({ group })` opens on one group only: `/` in focus mode opens the `Add` group, as
today.

**One list, the page on top.** ⌘K opens it and lists every command on offer, the innermost scope
first: what the field offers, then the block, the document, the collection list, and last what
the panel offers wherever the user is, create a document, go to a collection or an area. Typing
keeps that order, so the page's own lines stay above the panel's, and from two characters on the
documents come from the API, under their collection's heading, at the end:

```ts
// one request per collection the user can read, debounced 200ms
const url = `${apiUrl(collection.kebab)}?where[${collection.asTitle}][like]=%${query}%&select=${collection.asTitle}&limit=5`;
```

`Command.Root` gets `shouldFilter={false}`: bits-ui would sort the groups by their best score and
lose the order. The palette scores the lines itself with `computeCommandScore` from `bits-ui`, the
score the collection filter uses since `fa9bc2cd`, and drops what scores zero.

---

## 5. Who offers what

| scope        | where                                                       | commands                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root         | `Root.svelte`                                               | ⌘K, ⌘⇧K; global: _Create_ one line per collection the user can create in, _Go to_ one line per collection and area, from `routes`                                                                                                         |
| document     | `Document.svelte`, `Settings.svelte`, `ButtonStatus.svelte` | ⌘S save; versions history, save in a new draft, duplicate, import from the default locale, delete version, delete document (with its confirm); mark as published, as draft                                                                |
| collection   | `CollectionPage.svelte`                                     | new document, search in the list (focuses the input), new folder and bulk upload on an upload collection, show as a list, a grid, a tree                                                                                                  |
| folder       | `FolderEdit.svelte`                                         | ⌘S save                                                                                                                                                                                                                                   |
| live         | `LiveFloatingUI.svelte`                                     | ⌘S save                                                                                                                                                                                                                                   |
| blocks focus | `BlocksFocus.svelte`                                        | §4 of `builder-plan.md` as is: `Add` one line per type, `Block` duplicate, move up, move down, move into…, copy, paste, remove, collapse all, expand all, `Go to` one line per row; the arrows hidden; Esc close (`when: no dialog open`) |
| rich text    | `suggestion.svelte`                                         | `Text`: one line per suggestion item, `when: editor.isFocused`; no keys, no dialog of its own                                                                                                                                             |

`BlocksFocus.svelte` loses `onKeyDown` and `isTyping`; `CommandPalette.svelte` next to it is
deleted, its three groups are the scope above. `suggestion.svelte` loses its document listener and
its `Command.Dialog`, and becomes a scope: one `useCommands` over `allSuggestionItems`.

The blocks scope is mounted inside the document scope, the editor scope inside the blocks one:
⌘K in a rich-text editor in focus mode shows `Text`, then `Add`, `Block`, `Go to`, then
`Document`, then the root's `Go to`.

---

## 6. ⌘K, or ⌘⇧P

⌘K. It is what Slack, Linear, Notion and GitHub taught, and it is free: TipTap binds no `Mod-k`
here, and the link feature has no shortcut. ⌘⇧P is the editor's convention (VS Code, Sublime),
one more thing to know for a content editor. If a second key is wanted later it is one more line
in the root scope, same command.

---

## 7. Tests

**Unit**, `panel/util/keys.spec.ts`: `parseKeys` on every form of the table; `matches` on
`mod+s` with ⌘ and with Ctrl, on `shift+arrowdown`, on `/`; `formatKeys` on a Mac and not;
`isTyping` on an input, a `.ProseMirror`, a button.

**E2e**, `tests/fields/blocks-focus.test.ts` stays green as it is: `Control+k` opens the palette,
its lines carry the same text. One test more, `commands.test.ts` in `tests/fields`:

- ⌘K on a document: the first heading is _Document_, the panel's _Go to_ below it; "pa" typed,
  _Pages_ under _Go to_ and _Palette page_ under _Pages_; Enter on the first opens the list, on
  the second the document;

- on a document, ⌘K lists `Document › Save` and `Go to › Pages`; Enter on _Go to Pages_ lands on
  the collection;
- in focus mode with the rich-text editor focused, ⌘K lists `Text` first and `Add` after it; the
  arrows move in the list; Escape closes the palette and focus mode stays open; Escape again
  closes focus mode;
- ⌘S in a rich-text editor saves.

---

## 8. Order

1. `keys.ts` and its spec; `commands.svelte.ts`; `CommandPalette.svelte` in `Root.svelte`, with
   the root scope. Nothing else changes: ⌘K works everywhere, showing _Go to_.
   Then the documents search.
2. The three ⌘S onto `useCommands`.
3. `BlocksFocus` onto `useCommands`, its own palette deleted; `blocks-focus.test.ts` green.
4. `suggestion.svelte` onto `useCommands`; `commands.test.ts`.

One changeset, `Added:`, at the end of 4; `Changed:` on the rich-text ⌘K becoming a group of the
palette.

---

## 9. Open

- A key a plugin field wants: `useCommands` is exported from `rimecms/panel`, nothing else to do.
- The front page in live edit is another document; its Escape stays in `LiveEdit.svelte`.
- A conflict between two scopes on one key is silent: the innermost wins. A dev warning when
  two scopes claim the same key with `when` both true would tell.
