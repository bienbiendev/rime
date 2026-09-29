# rimecms

## 1.1.0

### Minor Changes

- [`600a17b`](https://github.com/bienbiendev/rime/commit/600a17bba092f77f716dd8228f4775148ca92605) - Changed: focus mode draws every blocks list on one stage, beside the layers, the inspector and the types to add. A block without a render is a row, its icon, its title and its type, with its nested lists under it; its fields are in the inspector, which leaves its lists of blocks out. A type drags from the _Blocks_ tab into any list, its place shown as a row. Under the block's fields, the inspector gives the count of each of its lists. _Focus on this block_, in the selected block's bar and in the inspector's head, narrows the stage to that block and what it holds, `?focus=sections.1`, the block selected and its fields in the inspector; a nested list's _Open the editor_ in the document opens it the same way. Escape widens it again.

- [`9fd8299`](https://github.com/bienbiendev/rime/commit/9fd8299ea9350b9ebb8730e5a50ea77ead67ecd7) - Added: `TextInline` from `rimecms/panel`, a `text` or `textarea` field edited where a block render draws it: the render's own element, `<TextInline as="h2" path="{path}.title" config={title} {form} />`, keeps its tag and its class. A text is one line, a textarea keeps its lines.

### Patch Changes

- [`ce893d3`](https://github.com/bienbiendev/rime/commit/ce893d3d5e0f6898713a4b82735a6075183f8b60) - Changed: `RelationInline` shows its controls in one quiet bar at the bottom right of the picked images, _Replace_ or _Edit the selection_ and a trash icon, clear of the block's own bar on top.

## 1.0.1

### Patch Changes

- [`706eae9`](https://github.com/bienbiendev/rime/commit/706eae9f8d27ec56dda0fcb8a5de72e8bcf059d8) - Fixed: a rich text's resource and upload nodes open their picker when they are inserted, not every time the document loads. A node stored without `_fresh` opened its picker on load, each one over the last.

- [`bdf553d`](https://github.com/bienbiendev/rime/commit/bdf553defa51587d6cf6593f7bea0d8bf07a5c34) - Breaking Change: a site page imports rime from `rimecms/public`, which never reaches the panel or the config. `openSse`, `createI18n`, `getI18nContext`, `setI18nContext`, `LiveProvider`, `LiveEdit`, `LiveConsumer`, `RenderRichText`, `richTextJSONToText`, `isRelationPopulated`, `isRelationResolved`, `isRelationUnresolved` and `resolveRelation` move there, from `rimecms`, `rimecms/fields/rich-text` and `rimecms/fields/relation`; `rimecms/fields/relation` is gone. `rimecms` keeps what a config and the panel use: `definePlugin`, `i18n` and `t__`; `cache` leaves it. `SignIn`, `ForgotPassword` and `ResetPassword` move from `rimecms/panel` to `rimecms/panel/public`, which the generated sign-in routes import: an anonymous visitor no longer loads the whole panel.

- [`addc409`](https://github.com/bienbiendev/rime/commit/addc409764392204432d1dff1aba7060d7ef59ac) - Changed: on a collection with `$url`, a new page takes its slug from its title. A `slug` field no longer gives it.

- [`bfe75b9`](https://github.com/bienbiendev/rime/commit/bfe75b9754f246c0e47568cdb1114c912c504631) - Fixed: deleting a page whose child has a slug a top page holds, or moving a page under a parent where a sibling holds its slug, answered 500. The moved page takes the next free slug: `team-2`.

## 1.0.0

### Major Changes

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Breaking Change: a block's `.image(url)` is removed, and the preview pane that showed it in the add-a-block menu with it. Give the block a `.thumbnail(Component)` instead: an SVG component, drawn in the pickers of types to add.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Breaking Change: the panel's colors come from a new set of tokens, and the old ones are gone. The grays and the accent are OKLCH colors set by four numbers, `--rz-gray-hue`, `--rz-gray-chroma`, `--rz-accent-hue` and `--rz-accent-chroma`, and `--rz-gray-0` to `--rz-gray-19` are full colors instead of HSL triplets. Components read the scheme's tokens, light and dark both set in `panel/style/scheme.css`: four levels (`--rz-bg-base`, `--rz-bg-page`, `--rz-bg-raised`, `--rz-bg-float`), translucent tints (`--rz-bg-well`, `--rz-bg-hover`, `--rz-bg-active`), `--rz-border`, `--rz-fg`, `--rz-fg-muted`, `--rz-fg-subtle` and the accent (`--rz-accent`, `--rz-accent-text`, `--rz-accent-tint`). CSS written against the old names (`--rz-color-fg`, `--rz-color-bg`, `--rz-color-spot`, `--rz-input-bg`, `--rz-row-bg`, `--rz-border` as a border shorthand, `--rz-shadow-md`, `@mixin ring`) has to move to the new ones.

- [`65b28ab`](https://github.com/bienbiendev/rime/commit/65b28ab95019321f2991a990f3c421f473268d3f) - Breaking Change: a collection with `$url` keeps each page's address in a table of its own, one row
  per page and per locale, shared by its versions. `$url` receives `{ path, slug, locale, doc }` and
  formats them: `` $url: ({ path, locale }) => `/${locale}/${path.join('/')}` ``. `[...parent.x]` is
  gone, the parents' slugs are `path`. Pages get a built-in slug, from their own slug field or their
  title, and `url`, `_urlPath` and `_slug` on their documents. A relative url is stored absolute.
  The next `rime generate` writes the migration that creates the table. Existing pages get their
  address on the first request after the upgrade.

- [`52a8a83`](https://github.com/bienbiendev/rime/commit/52a8a836f323c8336c6f97abf94c8aded35ee77c) - Breaking Change: the `doc` namespace is gone from `rimecms/util`. `util.doc.createBlankDocument(config)`
  is now `config.blank()`, and `util.doc.normalizeFieldPath` is now `util.string.normalizeFieldPath`.
  `toNestedStructure` moved to the nested feature and is no longer published.

### Minor Changes

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: `block(name).thumbnail(Component)` draws a block in the pickers of types to add. The component renders an `<svg>`, which fills a 16:10 frame and draws with `currentColor`, so it follows the light and dark themes; a block without one shows its icon. The pickers are one set of tiles: _Add a block_ in the document and `/` in the blocks editor open them in a dialog, three a row, with a search and the arrows to move; the editor's _Blocks_ tab shows them two a row, to click or drag.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: in the blocks editor, the selected block's move up and move down buttons sit in its floating bar with duplicate and delete, instead of beside the block. The inspector opens on a header with the block's icon, its label, its path and its duplicate and delete buttons.

- [`52a8a83`](https://github.com/bienbiendev/rime/commit/52a8a836f323c8336c6f97abf94c8aded35ee77c) - Added: a focus mode on every blocks field. _Open the editor_ on the field's label line, or _Open in the editor_ in a block's menu, opens the field over the whole page under `?focus=<path>`: a breadcrumb and Save on top, the layers on the left, the stage in the middle, the block types on the right. The layers start with a root node, the field or the block the list hangs off: selected, the stage shows every block of the list; a block row shows that block alone. Blocks drag between lists, nested ones included, when the list's block set has their type. The keys: arrows select, ⌥ arrows move, ⌘D duplicates, ⌫ removes, ⌘C and ⌘V copy and paste a block across documents, ⌘K opens a command palette: add a type, duplicate, move, move into a list, copy, paste, delete. Escape steps back one level, a drawer, then the selection, then focus mode; the close button and the back button leave focus at once, with the changes pending in the form. `blocks(...).layout('summary')` shows the field as one row in the form, a count and an _Edit_ button, the blocks edited in focus. The form's block operations are one object, `form.blocks`, with `insert`, `remove`, `duplicate`, `move`, `copy`, `paste`, `list` and `accepts`.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: `block(...).render(Component)` draws the block on the stage of focus mode. The component gets `block`, `path`, `fields` and `form`, so it can show the value, resolve its relations with `populate` from `rimecms/panel`, and mount panel fields with `RenderFields`; a `children` snippet draws the block's nested lists where the render puts it. With a render in the list, the stage becomes the stack of renders, click to select, and one panel on the right has three tabs, the layers, the selected block's fields and the types to add, the tab it opens on when the list is empty: a click on a render turns it to the fields, and with nothing left selected it turns to the types. A type drags from it onto the stage. The selected block has a bar above it, duplicate and delete, and arrows beside it to move it up or down; its layer row lifts, with a pencil that opens its fields. Relation lookups of the live store are cached for the page's life.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a blocks field in the form is one card of compact rows, each block closed to its grip, its icon and its name. A click on a row opens its fields under it, another closes it, and the browser remembers the open ones. A block's ⋯ menu opens it in the editor, moves it up or down, duplicates or deletes it. _Open the editor_ sits on the label's line, _Add a block_ under the card. In the blocks editor, the types to add are tiles, two a row, their picture or icon above their name, and _Type / to add a block_ sits under the blocks.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Added: the Bun pack. `rime init --bun` writes `adapterSqlite('app.sqlite', { driver: 'bun' })`, which opens the database with `bun:sqlite`, and prefixes the app's vite scripts with `bun --bun`. `rime build` detects those scripts, runs the build on Bun, and writes the same `index.js` as the Node pack: run it with `bun index.js`. Migrations still go through drizzle-kit. `SqliteAdapter['db']` is now typed `SqliteDatabase`, which covers both drivers.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: files dropped anywhere on an upload collection's page upload into the folder on screen. While they hover the page, a veil says where they will land; a card in the corner follows the upload.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: a collection with drafts has a _Status_ filter (all, draft, published), and an upload collection an _All types_ filter (images, videos, audio, documents, other files, from the files it holds). Both filter the list and the grid on screen.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a collection page runs the full width of the page. Under its title, a line counts the documents and the drafts, and for an upload collection the files' total size. The toolbar holds, on the left, the search, the filters and a list / grid / tree switch. The list is one card: the title with its path, the status, the author with an avatar, and when it changed (_2 h ago_, _Yesterday_, then the date). A row's checkbox shows on hover; checking one starts the selection and brings up its actions, so the select button is gone. A grid item is a media card: the thumbnail, the file name, its size and type (_3.2 MB · JPG_). Folders are small tiles above the files. An upload collection has one _Upload_ button, which goes through the bulk upload, next to _New folder_; the create and _Bulk upload_ buttons are gone.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: the tree view of a nested collection has the tree field's rows: a grip, a chevron that folds a page's children, a guide line down from each parent, and the list's columns (status, author, updated).

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: a command palette for the panel, on ⌘K. It lists everything on offer under headings, what the page offers first: the editor's marks and nodes when a rich text has the focus, the blocks of focus mode (add a type, duplicate, move, copy, paste, remove, go to a row), the document (save, versions history, save in a new draft, duplicate, delete, mark as published or draft), the collection list (new document, search, new folder and bulk upload, show as a list, a grid, a tree), then what the panel offers wherever the user is: create a document in any collection, go to a collection or an area. Typing also searches the documents by their title. Every key of the panel goes through the same dispatcher: a component offers its commands with `useCommands` from `rimecms/panel`, and the innermost one that claims a key gets it.

- [`52a8a83`](https://github.com/bienbiendev/rime/commit/52a8a836f323c8336c6f97abf94c8aded35ee77c) - Added: every collection and area config carries `blank()`, a document of its own shape with every
  default applied. It replaces the `createBlankDocument(config)` function and works on both halves,
  so the panel builds a blank document from the config it already holds.

  ```ts
  const page = config.getCollection('pages').blank();
  ```

  A field builds its own share of it: `blank()` on the builder answers with the members that field
  owns, so a group nests, tabs spread one member per tab, and a presentational field contributes
  nothing.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: the dashboard runs the full width of the page. It greets the user by first name with today's date and the number of drafts waiting, and shows each collection as a card with its count and its latest documents: rows with their status and when they changed, the latest medias for an upload collection, or people with their initials and role for an auth collection. The areas and the people sit in the right column, each area with its last update. Without `panel.dashboard.maxEntries`, a collection lists 3 documents, and an upload collection 4.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a document opens on its title as a heading, with a line under it naming the collection and who edited it last, and when. The bar's actions are quiet ghost buttons, the auto-save note, the page link, the locale, the status as a dot and its name, a _⋯_ menu, then _Save_; the menu's rows carry an icon, the deletions sit last in red, and _Copy the ID_ joins them. Field labels are small and muted, hints subtle, with links in the accent. A slug carries a _#_ before it, and _Build it from the title_ is a link under it. Toggles and checkboxes are rows of a card, the name on the left and the control on the right, and the ones that follow each other share one card. A group is a card with a hairline under its head; folded, it lists its values in two quiet columns. A relation lists its picks as chips in a well, with _Choose…_ and _Create new_ on the label's line; an upload relation fills its row of thumbnails with empty squares. The upload collection's drop zone matches the one of the relation fields. The dates and the id at the bottom are plain subtle lines.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Added: `$index()` on a field indexes its column, for a field a list is filtered or sorted by:
  `text('sku').$index()`.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Added: `rime.collection(slug).findByIds({ ids })` reads several documents in one query. Each id is
  checked against the read access as `findById` checks it; a missing or refused one is left out.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a link field is one box like any input: the type on the left, a menu when there are several (the plain types, then the collections by their singular label), its icon alone when there is one; then the value; then _New tab_, a checkbox, for a URL or a document. The whole box takes the focus ring and the error.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a page opens on a bar with the breadcrumb, `Pages › Home`, on the left and its actions on the right, the language switcher among them as `EN ▾`. A document's actions are ghost buttons (open the page, the live editor, the status) and a ⋯ menu (versions, duplicate, copy the ID, delete) before _Save_. Under the bar, the document's title as a heading and a line with its kind, who edited it last and when. The document's dates and id sit at the bottom of the page. The other locales are in the palette too, _Switch to <language>_.

- [`65b28ab`](https://github.com/bienbiendev/rime/commit/65b28ab95019321f2991a990f3c421f473268d3f) - Added: a page of a collection with `$url` shows its url under its title, with a button to copy it
  and _Change url_, a dialog that edits its slug on the published page. A nested page lists the
  pages under it after its fields.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: `RelationInline` from `rimecms/panel` lets a block render pick its images in place. It wraps what the render draws for a relation to an upload collection: while empty it draws a _Choose an image_ button, once picked it hands the docs to the render's `children` snippet, and on the selected block it shows _Replace_ and _Remove_, or _Edit the selection_ for a many relation, which open the upload picker. It writes the same field the inspector shows.

  ```svelte
  <RelationInline path="{path}.image" config={image} {form}>
    {#snippet children({ docs })}
      <img src={docs[0].sizes.md} alt={docs[0].alt} />
    {/snippet}
  </RelationInline>
  ```

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: ⌘K in a rich-text editor opens the panel's command palette with the editor's marks and nodes first, instead of a dialog of its own.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: `RichTextInline` from `rimecms/panel`, a rich text edited where a block render draws it: the editor and its controls over the form's value, no fieldset, no label. The editor's typography is the same in a field and in place, with a plain variable behind each choice, `--font-text`, `--font-heading`, `--font-size`, `--font-weight`, `--line-height`, `--margin-bottom` and the others, set on the editor for every element or on one element. The field keeps its boxes in a stylesheet of its own.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: `/` typed on an empty line of a rich text opens the command palette on the text's headings, lists and other nodes, and is not written. The placeholder reads _Write, or type / to insert…_; ⌘K still opens the whole palette.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Changed: the generated schema indexes `owner_id` on every child table (blocks, tree, locales,
  versions, relations), each relation target column, `updated_at`, and `_parent` on a nested
  collection. A list of 20 documents over 300 pages drops from about 17 ms of SQL to about 1 ms.
  The next `rime generate` writes the migration that creates them.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: the panel's sidebar holds the site's name, a button to fold it and the command input on top, the navigation under them, the signed-in user at the bottom. Folded, it keeps the icons, and the command input turns into a search button. The command button is gone from the page headers.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: `siteName` in the config, the name at the top of the panel's sidebar. Without it, the sidebar shows the host of `siteUrl`, then "rime".

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a tree field shows each item as a card. Its header holds a grip, a chevron and its title, a count of the items inside while closed, and a ⋯ menu to move it up or down or delete it. Open, a card shows its fields, then an _Inside_ zone with the items inside it, cards too, and a button to add one. A card drags by its header, shown alone while it moves; an accent line marks where it lands, and a drop in an _Inside_ zone puts it inside that item. An item's title is `renderTitle`, else the field's label and its place: _Links 1.2_ where it was _1.2 - Links_.

- [`65b28ab`](https://github.com/bienbiendev/rime/commit/65b28ab95019321f2991a990f3c421f473268d3f) - Added: `rime.collection(slug).updateSlugById({ id, slug, locale })` and
  `PATCH /api/<collection>/<id>/slug` change a page's slug in one locale, on the published page. The
  pages under it follow. A slug a sibling holds is refused.

- [`65b28ab`](https://github.com/bienbiendev/rime/commit/65b28ab95019321f2991a990f3c421f473268d3f) - Changed: a document's url comes with its row: reading a list of nested pages no longer runs a query
  per parent of every page, and a read no longer writes. Moving a page, or changing its slug, updates
  the addresses of every page under it in one statement per locale.

### Patch Changes

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: on a narrow screen, focus mode keeps the stage; its panel moves to a sheet, opened from a button in the header, and a click on a render opens it on the block's fields.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: moving a block in the blocks editor keeps the lists nested in the blocks around it, their rich texts and renders, instead of building them again; the page no longer jumps to the top in a browser that restores its scroll by hand, like Safari.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: in focus mode, the panel's tab of block types is named _Blocks_, and a search sits above the types when there are more than ten, on their label, name and description.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Added: a block drags on the stage of focus mode, by its body, between lists and to and from the layers; an editable spot inside a render keeps the mouse.

- [`2c50150`](https://github.com/bienbiendev/rime/commit/2c5015040f689c5a7059e420a86e703ee98180ae) - Fixed: `POST /api/clear-cache` answers 403 to anyone who is not staff. It emptied the API cache for any caller.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a page dragged in the tree view shows at the level it will land at while it moves, instead of at the first level until it is dropped.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: the command palette shows its keys at the bottom: arrows to move, enter to run, escape to close.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a dialog's buttons share its width, and show their keys: _Confirm ↵_, _Cancel esc_. Enter confirms from anywhere in the dialog but a field, a button or a link, which keep it. A panel `Button` shows a key with `kbd="enter"`.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: a document's fields stop growing on a wide screen and centre themselves, at `40rem`. `--rz-document-width` on the panel, a collection's page or one document changes it; the page gutter stays the floor, the document's heading lines up with its fields, and the collection list and the dashboard are untouched.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Changed: every field drawn as a well (text, textarea, select, number, date, link, relation search, rich text) has a subtle border, darker on hover, like the checkbox and toggle rows. The number field's up and down steppers sit in a column of their own, a hairline before it and between them.

- [`5c63e02`](https://github.com/bienbiendev/rime/commit/5c63e025fe0afa6b87ad7146d92853aa13706792) - Fixed: a `tabs` field nested inside a group or a block now keys its children under the full path instead of dropping the prefix, and a group, tabs or blocks field inside a tree row gets the config-map entries it never had — its children's hooks, access checks, default values and validation run like anywhere else. `getFieldAtPath` also resolves a path deeper in a tree, `footer.nav.0._children.1.label`, which returned `undefined` before.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a field in a moved block keeps its path, its condition and its disabled state up to date; a field with a condition no longer disappears after a move.

- [`52a8a83`](https://github.com/bienbiendev/rime/commit/52a8a836f323c8336c6f97abf94c8aded35ee77c) - Fixed: a tree or a blocks field nested in a block, a group or a tab produced a `,,` in the generated document type, which TypeScript refused.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Fixed: `rime init` swapped `adapter-auto` for the Node adapter only in `vite.config.ts`, so an app declaring it in `svelte.config.js` kept `adapter-auto`, which builds no server for Node, and re-running `init` never saved the swap. The adapter is now set wherever it is declared; any other adapter is left alone.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a folded row in the blocks editor's layers stays folded on its block when the block moves.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a rich text whose text ends with a link no longer takes the focus and scrolls to it when it shows.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Changed: `equals` and `in_array` on a localized field first narrow to the documents with a locale
  row holding the value, so a column indexed with `$index()` is read through its index instead of
  checking every document.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a relation field follows its value when it changes elsewhere: the images a block's render picks in place show in the inspector beside it.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a relation field or a select field with many values no longer throws "Instance exist. Should never happen." when its list re-renders: the drag and drop is torn down before it is set up again, and dragging the picked chips reorders them.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Fixed: with `depth`, a related document that is missing or that the reader may not see is left out
  of the relation. It used to drop the whole document from a list, or fail a read by id.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: the upload picker of a relation field marks what is picked, with its position for a many field and a check for a one field. A click on a picked image takes it out instead of throwing. A one field closes on a pick, which replaces the one before; a many field stays open, counts the picks in a footer and closes on _Done_. A press dragged across the images picks them all, or takes them all out when it starts on a picked one, and shift-click picks the range from the last pick. A button in its header creates a document without leaving the picker, and the new one is picked; with nothing uploaded yet, the grid says so and offers to create the first one.

- [`1cbaeed`](https://github.com/bienbiendev/rime/commit/1cbaeed6d7ceb0928d416b098856d443412673ef) - Changed: with `depth`, the documents a list's relations point at are read in one query per
  collection and level, instead of one `findById` per relation. A list of 20 pages at depth 1 goes
  from 40 reads to 1.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a rich text's editor is destroyed with its field, and starts with its content instead of getting it after.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a rich-text field follows its value when something else sets it, another editor on the same path or a pasted block, instead of keeping the content it mounted with.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a shortcut on a character some keyboards type with Shift works on them too: `/` in the blocks editor, Shift + `:` on a French keyboard.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a dragged block, row or item no longer drops its text into a rich text under the pointer, and a paragraph dragged by its handle inside a render no longer drags the whole block with it.

- [`25dc00f`](https://github.com/bienbiendev/rime/commit/25dc00f4569a6109df649c5f185432d0eb1ab5b2) - Fixed: a tabs field no longer reads `localStorage` while the page renders on the server, which made Node 25 and later warn that `--localstorage-file` was not provided.

- [`52a8a83`](https://github.com/bienbiendev/rime/commit/52a8a836f323c8336c6f97abf94c8aded35ee77c) - Fixed: `createBlankDocument is not defined` at boot. The `util` barrel re-exported `doc.ts`, and
  library code that reached for `validate`, `access` and `random` through the barrel closed a cycle
  back into it, so the barrel's namespace spread ran while `doc.ts` was still evaluating. Those
  modules now import what they use directly, and the barrel is a leaf of the import graph.

## 0.34.0

### Minor Changes

- [`41fe42e`](https://github.com/bienbiendev/rime/commit/41fe42e41b9e806ed67185a3bb1cf127b07eaf37) - Added: `createI18n(dictionaries)` from `rimecms` is the panel's translator over an app's own dictionaries, sharing nothing with the panel's: `$1` parameters, `|m`, `|f`, `|p` variants, a key it has nothing for returned as is. Given a function it reads the dictionaries on every call, so a translator over a layout's `data` follows a locale switch. `setI18nContext` and `getI18nContext` pass one down a Svelte tree. The `i18n` and `t__` exports stay the panel's own; on the server one instance serves every request, so an app's texts belong in `createI18n`.

## 0.33.0

### Minor Changes

- [`78324b3`](https://github.com/bienbiendev/rime/commit/78324b36ed9ab47cb4174439494f255420d08165) - Added: `$sse` in the config takes the event stream's `access`, which says which keys a caller may listen to besides the panel's own. `SSEAccess` and `SSEConfig` are exported from `rimecms/types`.

### Patch Changes

- [`3217525`](https://github.com/bienbiendev/rime/commit/32175257874a2546ee584a1d61f241f1740583c1) - Fixed: a required date field generated `.default(0)` on a `timestamp_ms` column, which drizzle types as `Date`. The schema now writes `.default(new Date(0))`; drizzle-kit stores the same `0`, so no migration follows.

## 0.32.1

### Patch Changes

- [`6cbf29a`](https://github.com/bienbiendev/rime/commit/6cbf29ae0d5c274e914bb0218cd30b1ec619d1ea) - Fixed: the generated schema referenced a relation target by its slug, so a camelCase collection (`eventsCategories`) produced a junction column pointing at an undeclared `eventsCategories` table instead of `events_categories`.

## 0.32.0

### Minor Changes

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: auto-save on `versions: { draft: true, autoSave: true }`. An editor's typing lands in a row of their own after a short pause, is offered back by a banner when newer than the row on screen, can be opened and finished by anyone, and becomes a version on save with the status of the row it branched from.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Changed: `latest` and `versionId` on the public read endpoints are honoured for staff only; anyone else gets the published version. The versions collection (`/api/<slug>--versions`) is readable by staff only.

- [`19a6726`](https://github.com/bienbiendev/rime/commit/19a67264053cef99105e9a775cff0089b0126e37) - Breaking Change: Drizzle ORM and Kit move to 1.0.0-rc.4.

  **Your `db/` folder needs converting.** Drizzle 1.0 restructured it — `meta/_journal.json` is
  gone and each migration's snapshot now sits beside its SQL. Rime detects the old shape and runs
  `drizzle-kit up` for you on the next generate, but it rewrites files git is tracking, so commit
  before upgrading.

  The migrator also changed how it decides what to apply: every missing migration runs, matched by
  full folder name rather than by timestamp order. A linear history is unaffected; one that has
  merged branches may not be.

  Both packages are pinned to the exact release, and `rime init` installs that same version — an app
  on a different rc than the rimecms it installed is a split that fails at runtime, not at install.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: `duplicate` takes a `versionId` (`POST /api/<slug>/<id>/duplicate?versionId=`) and copies that row, auto-saved or not; the panel duplicates the row on screen.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Changed: the edit lock is held on the version being edited, named by `?versionId=` on the lock endpoints, and moves with the row an auto-save or a fork makes.

- [`19a6726`](https://github.com/bienbiendev/rime/commit/19a67264053cef99105e9a775cff0089b0126e37) - Breaking Change: `$rime/modules` should now include full path from lib to module(.server).ts, ex: `$rime/modules:path/from/lib/to/module`. This is to avoid ambiguity.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Changed: the version history is a drawer on the document page, opened from the settings menu, instead of a route. The panel no longer remounts on every URL change; the listing and the document are keyed on what identifies them. "Delete this version" and "Delete the document" are two menu items.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: a read fills an untranslated localized field from the other locales, field by field, requested locale first, then the default, then the rest in config order; filters and sorts on a localized field see the same value. Localized blocks, tree and relation fields do not fall back. `localization.fallback: false` reads one locale only; `localeFallback: false` does it for one read. A new version keeps the translations its original has.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Breaking Change: a create writes one locale; the created locale's values are no longer copied into the others. The `isFallbackLocale` context flag and its validation, hook and access exceptions are gone; `isLocaleCopy` marks the per-locale copy behind `duplicate` and new versions.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Added: `$references(slug, { resolve: true })` on a text field resolves the referenced document on read; `createdBy`, `updatedBy` and `currentlyEditedBy` read as `{ id, name, email }`. `$root()` on a relation is refused by config validation.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Breaking Change: `draft` is a status, nothing else. `latest` selects the newest version on a read and on a write (`GET ?latest=true`, `PATCH ?latest=true`, `latest: true` on the Rime API) where `?draft=true` used to; `fork` makes a new version from the selected row (`PATCH ?fork=true`, `fork: true`) where `PATCH ?draft=true` used to. An update starts from the row a read would return, so an update on a document with no published version answers `404` unless it says `latest=true`. A config with versions and no drafts keeps a version per save.

### Patch Changes

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: a singleton's bootstrap no longer writes an empty locales row; a `null` element in a relation list is skipped instead of answering 500; a locales branch fetched under `select` carries its locale; an empty string in a required localized column counts as unwritten; `updatedAt` comes from the version row like `updatedBy`.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: a `RimeError` out of a panel action is shown in the form, and a redirect answer is applied, so an area's "save in a new draft" lands on it; switching locale with unsaved changes flushes the auto-save or asks first; a create form no longer turns into an update when a field writes `id`, which broke creating an upload directory; a self-disabling menu item no longer keeps the menu open.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: an upload collection with image sizes keeps its blocks, tabs, groups, tree and relation fields in the generated document type.

- [`f2a6774`](https://github.com/bienbiendev/rime/commit/f2a6774ecf560562719403cf21b5b057aa2b5d27) - Fixed: publishing through a fork or a named version demotes the previous published version; `maxVersions` prunes a config without drafts; a promoted auto-save keeps the status it inherited; a status change refreshes the version history; `findById` and the area `find` no longer drop the read intent, so an update starts from the published row as documented.

## 0.31.5

### Patch Changes

- [`bf0c0d8`](https://github.com/bienbiendev/rime/commit/bf0c0d8d6d8bf185bf49835aa4ce3815cadea1cd) - Added: configurable `/panel` path over env var `RIME_PANEL_ROUTE`

- [`3ba9562`](https://github.com/bienbiendev/rime/commit/3ba9562d654fdf458754853d2ba50b07f2935ff2) - Fixed: an issue where `hooks.server.ts` was fully reseted after a `RIME_CONFIG_DIR` change and a regeneration.

- Breaking Change: `/panel` path is now configurable, meaning you may run `rime generate --force` after updating to regenerate `/(rime)` routes

## 0.31.4

### Patch Changes

- [`684a43e`](https://github.com/bienbiendev/rime/commit/684a43e229e618a073cf700b48b0b94f92b150af) - Added: Custom config directory under `RIME_CONFIG_DIR` env var

- [`684a43e`](https://github.com/bienbiendev/rime/commit/684a43e229e618a073cf700b48b0b94f92b150af) - Breaking Change: Default config directory path is now `src/+rime`, you may add `RIME_CONFIG_DIR=src/lib/+rime` to .env, if yours differs.

- [`b14a276`](https://github.com/bienbiendev/rime/commit/b14a27687bf14ffa353aca73e852164cdbad90c3) - Upgrade `better-auth` from `1.4.21` to `1.7.1`.

  The `apiKey` plugin now ships as the separate `@better-auth/api-key` package. The generated `auth_accounts` table gains a required `issuer` column and renames `account_id` to `provider_account_id`; the generated `apikey` table renames `user_id` to `reference_id` and adds `config_id`.

  There is no automated data migration. Upgrading requires dropping and recreating the `auth_accounts` and `apikey` tables (or resetting the dev database) and re-creating users.

## 0.31.3

### Patch Changes

- Fixed: custom collection CustomHeaderComponent fails to retrieve the collection context

- Fixed: make argument optionnal for local api collection methods `delete` and `find`

## 0.31.2

### Patch Changes

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop collection context `addDoc|updateDoc|deleteDoc``methods

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop getCollectionContext KEY argument

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Added: Expose `CONTEXT.<NAME>` under `rimecms/panel` to allow simpler context retrieval ex: `getContext(CONTEXT.COLLECTION)` from consumer libs.

- [`3e6d1b0`](https://github.com/bienbiendev/rime/commit/3e6d1b02fe76d1706d1336a8863d10129e8d055d) - Breaking Change: Drop getAPIProxyContext KEY argument

## 0.31.1

### Patch Changes

- Fixed: `module.(server.)ts` pairs not resolve at root src/lib
- Fixed: `$rime/modules` types not generated on `rime generate` command
