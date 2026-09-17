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
  /** Fires while typing in a field. Off, a single key stays the field's; a `mod` chord fires anyway. */
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
      if (typing && !command.inField && !parseKeys(command.keys).mod) continue;
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

**A second page: search.** The palette has two pages, `commands` and `search`. The root command
`search`, _Search…_ in `Go to`, icon `Search`, keys `mod+p`, turns the page: the input empties,
the placeholder says so, and the list is what the query names: a collection's list page, an area,
a document.

```ts
// one request per collection the user can read, from two characters on, debounced 200ms
const url = `${apiUrl(collection.kebab)}?where[${collection.asTitle}][ilike]=%${query}%&select=id,${collection.asTitle}&limit=5`;
```

The collections and the areas are scored on the client, `computeCommandScore(label, query)` from
`bits-ui`, the score the collection filter uses since `fa9bc2cd`; the documents come back ranked by
the same score on their title. One list, three groups: _Collections_, _Areas_, then one group per
collection the documents came from, each line with the config's icon. Enter goes to
`panelUrl(kebab)`, `panelUrl(kebab)` for an area, `panelUrl(kebab, id)` for a document. On this
page `Command.Root` gets `shouldFilter={false}`: the page has filtered. Backspace on an empty
input, or Escape, goes back to the commands page.

---

## 5. Who offers what

| scope        | where                   | commands                                                                                                                                                                                                                                  |
| ------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root         | `Root.svelte`           | ⌘K palette; _Go to_ one line per collection and area, from `routes`; _Search…_ (⌘P), the search page                                                                                                                                      |
| document     | `Document.svelte`       | ⌘S save (`when: form.canSubmit`); later: duplicate, versions                                                                                                                                                                              |
| folder       | `FolderEdit.svelte`     | ⌘S save                                                                                                                                                                                                                                   |
| live         | `LiveFloatingUI.svelte` | ⌘S save                                                                                                                                                                                                                                   |
| blocks focus | `BlocksFocus.svelte`    | §4 of `builder-plan.md` as is: `Add` one line per type, `Block` duplicate, move up, move down, move into…, copy, paste, remove, collapse all, expand all, `Go to` one line per row; the arrows hidden; Esc close (`when: no dialog open`) |
| rich text    | `suggestion.svelte`     | `Text`: one line per suggestion item, `when: editor.isFocused`; no keys, no dialog of its own                                                                                                                                             |

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

- ⌘K, _Search…_, "pa" typed: _Pages_ under _Collections_ and _Focus mode_ under _Pages_; Enter on
  the first opens the list, on the second the document; ⌘P opens the search page straight away;

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
   Then the search page.
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
