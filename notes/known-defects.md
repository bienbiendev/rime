# Known defects

## `derived_inert` warning in the browser console

```
[svelte] derived_inert
Reading a derived belonging to a now-destroyed effect may result in stale values
```

Seen in the `fields` e2e suite, which passes. 13 warnings, in these tests:

| Test                                                                   | Warnings |
| ---------------------------------------------------------------------- | -------- |
| `commands.test.ts` › The collection list offers a document, the search… | 2        |
| `commands.test.ts` › ⌘K puts the page on top, the panel below…          | 1        |
| `commands.test.ts` › ⌘K searches the documents by their title           | 1        |
| `commands.test.ts` › In focus mode, ⌘K in the editor lists the text…    | 1        |
| `blocks-focus.test.ts` › ⌘K moves a block into a nested list…           | 1        |
| `blocks-focus.test.ts` › A summary field is one row that opens focus    | 1        |
| `relation-upload.test.ts` › One: in the inspector, a click picks…       | 1        |
| `relation-upload.test.ts` › Inline, one: the render offers a choice…    | 2        |
| `relation-upload.test.ts` › Inline, many: the render picks several…     | 2        |

Every one of them opens a dialog and closes it: the ⌘K palette or the relation picker. Where to
look first: a derived read after its dialog is unmounted, in `useCommands`, the command palette
or the picker.

Not traced yet.
