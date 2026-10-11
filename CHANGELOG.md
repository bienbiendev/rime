# rimecms

## 1.3.0

### Minor Changes

- [`62fa564`](https://github.com/bienbiendev/rime/commit/62fa56420cc400090f62354400ba5a4efb1eb606) - Breaking Change: the SQLite database and its migrations move from `db/` to `storage/sqlite/` at the project root, beside the uploads, where no URL reaches. Run `rime db:move` once, with the server stopped: it moves the folder, points the paths of `drizzle.config.ts` that name `db/` at `storage/sqlite`, and adds `/storage` to `.gitignore` when no line covers it. A server that keeps its database in a deployed `app/` runs it there too. `rime build -w` (`--with-storage`) copies all of `storage/` to `app/storage/`: the database as well as the uploads, so a deploy that copies `app/` over replaces its database with the local one. Use it in place of `-d`, which is gone, and never to ship only the uploads to a server that keeps its own database. `-s` now copies `static/` alone, without the uploads. `rime build -w` refuses a project whose database is not in `storage/sqlite/` yet, and names `rime db:move`. `rime init` takes `--adapter`, `sqlite` by default.

### Patch Changes

- [`62fa564`](https://github.com/bienbiendev/rime/commit/62fa56420cc400090f62354400ba5a4efb1eb606) - Changed: the panel's fonts come from the package, through the panel stylesheet, and `rime init` no longer copies them into `static/`. An existing project may delete `static/assets/panel/fonts`.

- [`62fa564`](https://github.com/bienbiendev/rime/commit/62fa56420cc400090f62354400ba5a4efb1eb606) - Fixed: `rime uploads:move` works on a project whose adapter uses `driver: 'bun'`. Like `rime generate`, it opens the database with libsql on Node, instead of failing with "adapterSqlite driver 'bun' needs the Bun runtime".

## 1.2.0

### Minor Changes

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: rime no longer loads `.env` into `process.env`. The app reads its variables from `$app/env/private` and `$app/env/public`, the CLI and the Vite plugin from the env files the way Vite reads them, and the environment always wins over `.env`. A config that reads `process.env.X` gets `undefined` in dev on Node: declare `X` in `src/env.ts` and import it from `$app/env/private`. `PUBLIC_RIME_URL` is renamed `SITE_URL` and `RIME_SMTP_*` are renamed `SMTP_*`; `npx rime init -f` renames them in `.env` and adds every variable rime reads to `src/env.ts`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: an area with `$url` stores its url when it is saved, in a `<area>__$paths` table with one row per locale, as a collection's pages do, and a read joins it: `select: ['url']` answers it. The url is formatted from the area's published document, so a read of a draft shows the published url, and a change to `$url` or to `SITE_URL` shows after the area's next save. A project with such an area needs a migration for the new table: run `bun rime generate`, then drizzle-kit, as for any new table. The rows are written on the first request after deploy.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Added: the `$beforeDuplicate` field hook gives a field its value on a copy of its document, after the field type's own copy: `email('contact').unique().$beforeDuplicate(() => null)` leaves the copy without one.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: members that rime never sets or reads are removed from the published types: `$InferRoutes`, `$InferAreasSlug` and `$InferCollectionsSlug` on `BuildConfig`; `$database` on `BuiltConfig`; `getDocumentPrototype` on the config context; `unique` on `ComboBoxField`, `DateField` and `TimeField`; `layout` on `RelationField`; `tree` on `BlocksField`; `suggestionOpen` and `editor` on the rich-text context; `context` in the `SvelteNodeViewRenderer` options; `invalidateAll` and `urls` on the API proxy context; the unused getters of the collection, document form and errors contexts; the `status: 401` arm of `CollectionDocData` and `AreaDocData`; `lastEdited` and `titleSingular` in the dashboard entries; the `TranslationKey` and `ModifiedKey` types; and the panel translation keys nothing reads. A panel language with no dictionary loads none, where English was loaded in its place.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: duplicating a document of an auth or upload collection answers 400 through the API, as the panel already refused it. An auth document is a user with an account, and an upload document is a file on disk.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: errors are answered by SvelteKit's `handleError`, which rime exports from `rimecms/server` and adds to `src/hooks.server.ts` when the file has none. A `RimeError` keeps its status, a thrown `error()` keeps its own instead of becoming a 500, and an unexpected error is logged with its stack, its message never sent.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: a JSON body is taken as it is sent. `"true"`, `"12"` or `"null"` sent as strings stay strings, where they were turned into a boolean, a number or `null`: send `true`, `12` and `null`. A dotted key is no longer expanded: send `{ "meta": { "priority": 4 } }`, not `{ "meta.priority": 4 }`. A form-encoded body written by hand is still read by the shape of each value, dotted keys included.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: a link to a document carries its target's `id`, `url` and `title` at every depth, `depth=0` and a link to its own document included. The target is read in the read's locale with only those selected, through its own read rules: a target the reader may not read, one never published, or one with no url gives none of the three. The save stores none of them, so a `url` sent with a document link is never shown. The panel's list cell shows the link's title.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: each surface reads its own locale. `/api` reads `?locale=`, the panel reads `?locale=` then its `rime.locale` cookie, and the site reads the route param named `locale`. A code the config does not list is skipped: the next place the surface reads is tried, the panel's cookie after an unknown `?locale=`, and the default locale when none is left. The cookie is written for the panel's path only, once a locale switch goes ahead, so the site and `/api` do not follow the panel's locale; it is `Secure` on https only, so a panel served over plain http keeps its locale. A panel save names the locale of the row on screen, so a cancelled switch, another tab or the live editor cannot move it. A site route names its locale `[[locale=locale]]`: rime generates the `locale` matcher, which types `params.locale` and leaves a segment that is not a locale to the next route. A site that keeps its locale elsewhere sets it with `rime.setLocale()`, which sets the default locale for a code the config does not list. A REST body carrying `locale` answers 400: name the locale with `?locale=`. `rime.getLocale()` is removed: read `event.locals.locale`. A duplicate or a locale copy leaves the request's locale alone: a hook reads the locale it writes in from `context.params.locale`. A read with `depth` resolves its relations and links in its own locale: `find({ locale: 'en', depth: 1 })` reads the related documents in `en` whatever the request's locale. The live preview reads related documents in the edited document's locale, and `Relation.resolve(value, { locale })` reads them in the locale given (the default locale without one). In the panel, the relation fields read their documents in the panel's locale, and a block's focus render receives `locale` beside `block`, `path`, `fields` and `form`: it reads a relation with `Relation.resolve(block.image, { locale })`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: a field inside tabs, in a localized group, blocks or tree, is localized, so each locale keeps its own value instead of sharing one. Its column moves to the matching locales table (`pages__$$locales`, `pages__$blocks_note__$$locales`, `pages__$tree_links__$$locales`), and the migration drops the old column without carrying its values: copy them over before applying it, for example `UPDATE "pages__$$locales" SET meta__seo__title = (SELECT meta__seo__title FROM pages WHERE pages.id = "pages__$$locales".owner_id);`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: text, textarea, slug and email fields store their value as typed, and the link field its `value`: `x < y` lost everything after the `<` on save. The panel and the site print these values escaped. A site that renders one with `{@html}` sanitizes it on save itself: `text('bio').$beforeSave(string.sanitize)`, with `string` from `rimecms/util`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: rimecms requires SvelteKit 3 (and adapter-node 6, Svelte 5.57.1, Vite 8.0.12). To upgrade an app, run `npx sv migrate sveltekit-3`, install rimecms, then `npx rime init -f`: it keeps what exists and adds `src/env.ts`, which declares the variables rime reads, and `src/params.ts`, which spreads rime's param matchers (an existing `src/params.ts` gets a warning with the two lines to add). The app's own matchers go in that same file, next to `...rime`. Delete the old `src/params/panel.ts`, `collection.ts` and `area.ts`. `ORIGIN` is gone: `rime build -e` writes an `app/index.js` that sends the origin of `SITE_URL` to adapter-node.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Breaking Change: uploaded files move out of `static/medias` to `storage/uploads/<folder>/<file>` at the project root, one folder per upload collection, and their URLs become `/uploads/<folder>/<file>`. `upload.folder` names the folder; it is the collection's kebab by default. Rime serves the files itself. A collection anonymous callers may not read serves its files only to callers who may read a document naming them; anyone else gets 404. No URL reaches `storage/`. Run `rime uploads:move` once to move the existing files.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Added: `url.isSafeUrl` in `rimecms/util` tells whether a URL can go in an `href`, for a custom `link` component of `RenderRichText`.

### Patch Changes

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an access rule written as `undefined`, such as `access: { read: flag ? anyone : undefined }`, keeps the staff-only default instead of answering 500 on every request it guards.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a user who deletes their own document loses their sign-in account and sessions with it, instead of the request failing and leaving the account behind.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `POST /api/init` with a weak password answers the password's own error under `password`, instead of `invalid_field` under `name`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an api key sent in `x-api-key` is a credential on its own. The request runs as the key's document with the key's roles, with no session needed, and a session sent with it is ignored. A key that does not verify, or one carrying `admin` that was made by someone who is not a better-auth admin, answers 401. Only an admin can give a key `admin` afterwards, and a key never opens the panel. Keys no longer stop at ten requests a day, existing keys included. A key used to be ignored without a session, with one it only replaced the session user's roles, and its eleventh request in a day answered 401.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: deleting an API key document removes its key, whoever created it, and the key stops authenticating. A key document that holds no key no longer deletes the account of the user who created it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: closing the new API key dialog with Escape or a click outside moves on to the new document, instead of leaving the page stuck.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: changing the `roles` of an API key document changes the roles a request made with the key carries.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an api key is refused to a signed-in user who is not staff before the key is made. The key was created and mailed, then its document failed to save, which left a live key with no document to revoke it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a site route whose path only starts with `/api` (`/apiary`) is no longer treated as an API route: no API CORS check, and its `slug` param is left alone.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: when an area is created for the first time, a required field that its initial document leaves empty takes its column's own default, and a NOT NULL column with no default gets an empty value of its type. A text or boolean column got an empty value over its default, and a number, date or JSON column with no default was left unfilled.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a new version of a localized area copies the other locales as a locale copy, as a collection does: their field hooks, validation and required checks do not run again on values already checked where they came from.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an area's panel page opens its newest version, a draft included, as a collection document's page does. It opened the published version.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the sign-in password field no longer shows the reset-password placeholder after a reset in the same tab.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a block removed while an auto-save is in flight no longer leaves an empty item in the list when the save comes back.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: better-auth's own user and admin routes under `/api/auth` (`delete-user`, `update-user`, `change-email`, `admin/*`) answer 404. An admin can no longer reset the super-admin's password or delete it through them, and a signed-in user can no longer delete their own document or move their session to another collection past rime's access and hooks.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a block named with `_` or `-`, like `call_to_action` or `hero-banner`, keeps the validation, hooks and relations of its fields. A required field in it no longer refuses every save, and a relation picked in it is stored. A block name holding a `.` is refused by the config check.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `localized()` on a blocks list gives the list its own copies of its block types, and leaves a block shared with another list as it is. A document that holds the same block in a localized list and in another list is now refused by the config check, where the block used to turn localized in both.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a block takes its place from where it sits in the data. A block read from the API and sent back in another order kept the `position` it was read with, and its relations ended up on another block.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in the blocks focus mode, removing a selection that holds a block under a folded row removes that block. It removed a block the user had not selected.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: saving a block list rewrites only the blocks whose sent values changed.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a blocks list refuses a block whose `type` it does not declare, with a 400 naming the field (`unknown_block`).

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: with `driver: 'bun'`, moving a page or refreshing its urls is all or nothing again. bun:sqlite committed the transaction before its updates ran, so a move refused in one locale stayed applied in the others.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: with the cache on, a route that sets its own `cache-control` keeps it, and a `load` calling `setHeaders({ 'cache-control': … })` no longer answers 500. `max-age=3600` goes on a response that has none.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the cache plugin adds `cache-control: private, max-age=3600` and `vary: Cookie` to a successful page only, so a browser no longer keeps a redirect or an error for an hour, and a sign-in or a locale change reads the page again.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a cached read answers the same document as the read it saved. With the disk strategy, dates stay dates instead of strings; with the memory strategy, each request gets its own copy, so a change one request makes never shows in the next.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: with the disk strategy, a cache key is stored under a hash of itself, so a key built from request input can no longer read or write a file outside `.cache/`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the API cache keys a read on the locale it runs in. A local read without `locale`, such as `rime.area('settings').find()` in a localized layout, served one locale's document to visitors of the other.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a checkbox that is not required is optional in the generated document type, `agree?: boolean`, like a toggle.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a page's `_children` lists only the children a reader who is not staff may read, their published versions, instead of the ids of children never published.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `rime build` stops when `vite build` fails, instead of packaging a missing or stale build.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an interrupted `rime generate` no longer stops code generation in later dev starts. Its marker names its process, and a marker left by a process that died blocks nothing.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `rime init -f` in a scoped package names the database after the package name made a slug (`@acme/site` → `acmesite`); `--name` refuses a value that is not a slug.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a server-only declaration that reads its own name, such as `const setHome = Hooks.beforeUpsert(async function setHome(args) {…})` or a helper that calls itself, is left out of the panel's copy of the config. It stayed there with its server imports, and the panel failed to load.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a field inside a localized group, blocks or tree keeps its `$references`: its foreign key, and a resolved reference.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a code generation step that fails in development (the routes, a migration, the types) runs again at the next start. It was taken as done until the config changed.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `component().access({ read })` and `component().condition()` hide the component, and `separator().className()` reaches the separator.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in dev, a config edit is picked up when `RIME_CONFIG_DIR` starts with `./`, and on Windows. It was ignored until the dev server restarted.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a config with a rich text `fields()` or `upload()` feature outside tabs no longer stops code generation with "Maximum call stack size exceeded".

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a CORS preflight from a trusted origin allows credentials, so a credentialed `PATCH` or JSON request from another origin goes through.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the site's own origin is always trusted, read without a path or trailing slash, and `$trustedOrigins` adds to it. An authored `$trustedOrigins`, or a `SITE_URL` ending in `/`, made the panel's deletes, status changes, slug changes and uploads answer 403.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: every API answer carries `Vary: Origin`, a preflight included, whether or not the request sent an `Origin`. A shared cache could hand one origin's answer to another, whose browser refused it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a date cleared in the panel's calendar is saved empty. It was saved as 1 January 1970, and a required date now shows its error instead.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a document whose title field is a `date('…').isTitle()` is titled with its day, `YYYY-MM-DD`, instead of its id. A title field that holds an empty string or an empty rich text now titles the document with its id instead of `''`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a date field refuses a value that is not a date, such as `"soon"`, with a 400 naming the field. It answered 500 on libsql and stored `null` on bun:sqlite.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: `_generateRoutes` is removed from the published `BuiltCollection` and `BuiltArea` types, and the `unknown` text from the error dictionaries: rime never sets or reads them.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a block or tree item in a default list that names some members of a group keeps the defaults of the members it leaves out.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a field the caller may not write is dropped with every field inside it, before it is validated. A group the caller may not write keeps its blocks, tree items and relations, its required members are not reported missing, a unique field the caller may not write is not looked up, and inside a block or a tree item the save sends, such a field keeps its stored value, the relations and nested rows it holds included, wherever the row moves. A new version keeps it the same way.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in a deno project, dev runs drizzle-kit through deno (`deno run -A npm:drizzle-kit`) instead of `npx`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an empty or unreadable `?depth=` reads as 0 on every API GET.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: config validation checks a slug starting with `$` too: it must be camelCase parts joined by `__`, like the slugs rime derives (`$pages__versions`). Any `$` slug used to skip the slug rules.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in dev, a second invalid config edit in a row prints what is wrong with the config. It answered `ENOENT … node_modules/.rime` instead.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a text made only of digits (`"2024"`, `"007"`) is saved as text, from the panel and from a JSON body. It was turned into a number, losing leading zeros, and refused by the text field.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a disabled link button does not navigate. In a read-only document, the live edit button no longer opens the live editor.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the generated type of a relation or a resolved reference to a rime collection, such as `$mediasDirectories`, names `MediasDirectoriesDoc`, the type that is declared, instead of `$mediasDirectoriesDoc`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a document read with an explicit `locale` says that locale. It said the request's locale, or none outside a request.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a duplicate keeps a `status` field the author declared on a collection without drafts, such as a ticket's `closed`, instead of resetting it to its default. On a collection with drafts, the copy still starts as a draft.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a duplicate or a locale copy that fails leaves the request in its own locale. It stayed in the default one.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a copy of a document first written in another locale takes, for each required field it has no value for in the default locale, the value a read shows there. Its title read `null (copy)`, and a required field left empty refused the copy.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: duplicating a document keeps a reference read as a document (`$references(…, { resolve: true })`). The copy saved it empty.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich-text title keeps its nodes and marks on a copy, with ` (copy)` added after its last text. It was written back as plain text.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a slug title becomes `my-page-copy` on a copy, and an email or date title is copied as it is. Each got ` (copy)`, which its validation refused.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a unique text or slug takes a free value on a copy: `Title (copy)`, then `Title (copy 2)`, and `my-page-copy`, then `my-page-copy-2`. The copy was refused as a duplicate value.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `email().placeholder()` sets the email field's placeholder.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an email address with a `+` tag or an apostrophe before the `@`, such as `ann+news@x.com` or `o'brien@x.io`, is accepted instead of answering `invalid_email`, and one with two dots in a row before the `@`, such as `a..b@x.io`, is refused.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an optional email, slug, number or time field can be emptied, in the panel and through the API. The empty value failed the field's format check; a number sent as `''` is stored as no number.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: three English panel texts read correctly: "only panel users can read it", "Operation successful" and "The changes you made will be lost".

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a variable the environment sets, `PORT` from the platform or the command line, is no longer overwritten by the one in `.env`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: `rime init`, `rime build -e` and `rime env` write the `.env` from one list. `rime init` on an existing `.env` adds the missing variables with their comments, `RIME_CACHE_ENABLED` included. The production `.env` writes `RIME_LOG_TO_FILE_MAX_DAYS=30`, `HOST=127.0.0.1` (the address `index.js` falls back to) and the same SMTP placeholders as development.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a field error follows its block or tree item when items are removed, moved, inserted or duplicated. An error used to stay at the old position, show on the wrong item or nowhere, and keep Save disabled until a reload.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: field defaults that only existed on a dev server, inside `tabs()`, now apply everywhere. A text or textarea refuses a value that is not a string, a checkbox or toggle one that is not a boolean, a radio starts on its first option, and a required `select().many()` refuses an empty selection. A number or link field starts empty unless it has a `.defaultValue()`, as it already did in production.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an upload's stored `filesize` moves up a unit when it rounds to 1000, `1.00MB` instead of `1000.00KB`, and reads in GB past 1000 MB.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `findByIds` hands the context its `beforeOperation` hooks return to the `beforeRead` hooks, as `find` and `findById` do.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an API form error reads each field's error as the panel shows it. A composite code read `errors.url::invalid_url`, and a custom validator's message was prefixed with `errors.`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the French panel texts for creating, finding nothing and searching no longer put a masculine article before every collection ("Créer un page"). They now read "Créer : page", "Aucun résultat : page" and "Rechercher : page...". A collection's `label.create`, `label.none` and `label.search` still take precedence.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a duplicated or pasted block, and content copied from the default locale, keep their rich-text page links and embedded images. Only the blocks, tree items and relation rows get new ids; an `id` inside a rich-text node stays.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `rime generate` no longer makes the next `vite dev` rebuild every dependency. Its Vite server keeps its cache in `node_modules/.rime/vite` instead of `node_modules/.vite`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a field named `d` (or `dd`, any run of the letter d) reads its value instead of nothing.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: saving a group with only some of its fields keeps the blocks and tree items of the others, and the relations inside them. They were deleted, while the group's other values were kept.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: saving a group with only some of its fields keeps the relations of the others. They were deleted, while the group's other values were kept.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a hand-written form keeps its values as the strings it sends, so a postcode, a phone number or a title such as `2024` is stored as typed instead of becoming a number, and a key sent several times, such as a `<select multiple>`, arrives as a list instead of its last value. A number field reads its string as a number, and a checkbox or a toggle reads `'true'`, `'on'` and `'false'` as booleans. `'null'` and `'[]'` still empty a field, and `'undefined'` is now kept as a string.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `HEAD` request on a REST route or on a route declared in `$routes` is answered by its `GET` handler. It answered 404.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a hook that answers without its arguments, such as one that forgets `return args`, fails with an error that names the hook and what it left out, instead of a `TypeError` further down the pipeline.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a translation keeps a brace with no `|` as written. Only `{a|b}` is a list of variants; `Use {name} here` read as `Use name here`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: every error code has a text in English and French. A weak password, a taken unique value or an invalid slug read as a sentence under the field instead of `errors.password_min_8`, and failure toasts read "An error occurred" instead of `error.generic`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a field error says what is wrong ("Required") instead of "Field is required" with the name missing. A `RimeFormError` message names each field before its text: `title: Required, slug: Only lowercase letters, digits and dashes`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a malformed query, body or uploaded file answers 400 instead of 500, and is no longer logged as a server error with its stack. An upload refused for its content keeps its reason, such as `File type not supported`, in place of `Unable to process file`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `access.isAdminOrMe` refuses an anonymous caller when no id is given. A list operation called it with no id, so an anonymous visitor passed a rule built on it, such as `read: (user, { id }) => access.isAdminOrMe(user, id)`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a JSON body that is not an object, such as `null` or `[]`, answers 400 instead of a 500 or a document made of defaults.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the keys inside a JSON value are read back as written. A key holding `__`, such as `foo__bar`, came back split as `foo.bar`. A JSON field inside a group whose value held a key with `$` (`{ $x: 1 }`) came back under its column name, `group__data`, rather than `group.data`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: on a collection or area with a camelCase slug (`blogPosts`), the version history and relation lists refresh after a save, an auto-save, a status change or a version delete.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: on a nested collection with a camelCase slug, the tree rows link to `/panel/blog-pages/<id>` instead of a 404. The edit link of a resource card in rich text does the same.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the last version of a document cannot be deleted while an auto-save is all that would stay, which left the document unreadable. An auto-save may always be deleted.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the media library search sends its text URL-encoded.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an emptied link is accepted as it is stored. Duplicating a document, or saving a blocks or tree list, that holds an emptied link answered 400.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the link field drops a `url` that would run script (`javascript:`, `vbscript:`, `data:`) when it is saved.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: switching a link field's type clears its text, instead of keeping the old text under the new type.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a link field refuses a link whose `type` its `types(...)` do not name, such as `{ type: 'other', value: 'javascript:…' }`, instead of storing it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a list delete that matches a row the caller may not delete, such as a super admin, leaves that row, deletes the others, and answers the ids it deleted, instead of failing halfway through. The panel's bulk delete counts the documents the answer lists, and says how many were not deleted.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `?limit=` and `?offset=` on a list GET or DELETE answer 400 unless they are whole numbers, from 1 for `limit` and from 0 for `offset`, instead of reading `?limit=abc` as no limit, which on a DELETE removed every match.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the list search works in a collection whose title is rich text, matching its plain text. A date title is left out of the search instead of throwing.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in a collection list, a sortable column inside a group or a tab sorts, and so does the Title column when the title field sits inside a group. A column placed with `.table(0)` comes first instead of last.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the close button of live edit on an area goes to the area page instead of a 404.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a page rendered with `<LiveConsumer>` opens its document's form in live edit and shows what is typed before it is saved.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: live edit opens for a collection or area with a two-word slug, such as `blogPosts`. The `update` key of `LiveEdit` is the document's API path without `/api`, with the slug in its URL form: `/blog-posts/123`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a document's `_live` link encodes its `src`, so a url with a `#` or a query opens live edit on the right document.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the live-edit link joins the site and the panel on one slash when `SITE_URL` ends in a slash.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: following a link with a query string inside live edit stays in live edit (`/news?page=2` becomes `/news?page=2&live=1`, not `/news?page=2?live=1`).

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a live-edited page ignores a message that is not an object, such as a string another script of the page posts, instead of throwing.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: live edit applies the panel's updates in the order they arrive. An update whose related documents were slow to read landed last and undid what was typed after it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: copying locales to a new version or a duplicate keeps a localized field named like a row meta, such as `ownerId` or `createdAt` inside a group. Such a field was never copied to the other locales.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a new version of a localized document keeps the edit that made it in the fields every locale shares, and keeps its blocks after a reorder. Copying the other locales onto a new version or a duplicate writes only their localized values; a localized field inside a shared block takes the other locale's value when the block at that position has the same type, and falls back on read otherwise.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `localized()` called before `fields()` on a group or a tree localizes the fields given after it. A group threw, and a tree left its fields unlocalized.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the edit-lock routes hand the request to the update access rule, as a save does, so a rule that reads `options.event` answers the same for the lock and for the save.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: when an auto-save or a fork carries the edit lock onto its new row, the other tabs on the document reload once instead of twice.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the edit-lock routes of a collection and an area answer 403 to a user who is not staff, instead of a 500.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `RIME_LOG_TO_FILE_MAX_DAYS` of `0`, empty or not a number keeps log files for thirty days. `0` or empty deleted today's file every hour, and a value that is not a number kept every file forever.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the log cleanup counts a file's age in local days. West of UTC, with `RIME_LOG_TO_FILE_MAX_DAYS=1`, today's log was deleted in the evening with every line written before.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: rime imports each Lucide icon from its own file (`@lucide/svelte/icons/<name>`), so the dev server no longer loads all ~1,900 icons at each start. A config that imports from `@lucide/svelte` itself still loads them all: import from the icon's file instead.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a read resolves 3 levels of relations at most, whatever `depth` it asks for. The cap holds for the REST API and the local API alike: `?depth=50` and `rime.collection('pages').find({ depth: 50 })` both read at 3. A negative `?depth=` reads as 0.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `maxVersions` keeps the newest versions of each document. It counted the whole versions table, so saving one document deleted other documents' versions, sometimes a document's only version, which then read as missing. `maxVersions` defaults to 12, so every collection or area with versions was affected.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a signed-in member of a non-staff auth collection can create a document where the collection lets them, instead of answering 500 on the `createdBy` foreign key. `createdBy` and `updatedBy` record staff only, and only staff may set them on a create.

- [`857f208`](https://github.com/bienbiendev/rime/commit/857f20888a880b5debd0c6c133c193113713deed) - Added: in development, a migration that drops a table or a column asks before it is applied, `Continue? [y/N]`. No, or no terminal, applies nothing: the migration and the schema are put back and the boot stops. A table drizzle-kit rebuilds to change a column keeps its rows and is not asked about.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: converting a migrations folder from before drizzle 1.0 no longer counts the converted migrations as new. An old migration that dropped a table made the boot ask about data loss, and a refusal, or a boot without a terminal, deleted the whole migration history.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a move in a nested collection's tree that the server refuses shows an error and the stored order, instead of "Order updated". The stored order shown keeps its unpublished documents.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `tabs()` inside a group, block, tree item or tab reads and writes its fields at their own path (`meta.seo.title`). It used `meta..seo.title`, so stored values showed empty and an edit was saved under an empty key.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: "Save in a new draft" leaves the Save button as it was. After a new draft that failed, a plain Save forked another version, and could turn the published version into a draft.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a new block or tree item sent without some of its fields gets each one's default, `null` without one, so a required field it leaves out is refused instead of being saved empty. A stored row sent in part keeps its stored values.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a new version takes the fields the caller may not write from the version it branches from, on `?fork=true`, on every save of a versioned config without drafts, and on an auto-save. The caller's values for those fields, an upload's file name and image sizes among them, were written to the new version.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: removing the file of an upload document whose every save makes a new version leaves the new version with no file, instead of giving it the previous version's file back. The previous version keeps its file, on disk as long as a version names it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich-text node view drops an attribute its `attrs` option no longer gives, such as a `data-empty` once a document is picked.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: saving a group or a tab as `null` clears every value inside it, and a required field inside it answers its form error, as it does when sent empty. The previous values were kept.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `number().min(0)` and `.max(0)` are bounds. A bound of 0 was ignored.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `object.getValueAtPath` and `object.deleteValueAtPath` find nothing on a path that runs through `null` or a primitive. `deleteValueAtPath` no longer throws there, `getValueAtPath` no longer throws on `null`, and it no longer reads a string's own properties: `getValueAtPath('title.length', { title: 'abc' })` is `undefined`, where it was `3`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `object.setValueAtPath` replaces a parent that cannot hold a key, such as a string, with an object or a list, as it does for a falsy one. It used to set nothing.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: on a versioned list, an `offset` that is not a number is ignored, as it already was on other lists. `?offset=abc` answered 500.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a select, combobox or radio option holding a quote, such as `l'été`, is written as a valid string literal in the generated types, which no longer fail to compile.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: moving a page under itself or under a page below it answers 400 before anything is written, instead of storing a `_parent` that loops and dropping both pages from the tree.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the command palette names a document by its title when the title field sits inside a group, instead of its id.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `panel.components.collectionHeader` renders above the collection list. The config dropped it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: panel dates are formatted in the panel language, not the content locale: "Créé le samedi 3 oct. 2026" instead of "Créé le Saturday, Oct 3, 2026".

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an area with `panel: false` is left out of the panel sidebar, as a collection is.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a panel language rime has no texts for shows the English texts, and an error names the language. It showed raw keys. A translation file that fails to load now leaves the others in place.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a panel link to another collection, area or collection document shows that page on the first click. The page load now reads the slug from its own event, so SvelteKit runs it again when the slug changes instead of keeping the previous page's data.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a custom panel route imports its component by a relative path, so a component from a package resolves in dev and in `vite build`, and a lowercase or kebab-case file name works. A component with no file to import logs an error.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a custom panel page whose `component` is an imported Svelte component (`panel.routes: { stats: { label, component: Stats } }`) renders it. The page read "Cannot parse provided component path".

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in development, changing `RIME_PANEL_ROUTE` regenerates the routes at the next start. Every panel URL answered 404 until the config changed too.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a custom panel route without a `group` is listed under the Dashboard link. Every panel page answered 500.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a password counts any character that is not a letter or a digit as its special character, so `/`, `,`, `[`, `~` or a space no longer reads as "Needs a special character".

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: creating a user with two different passwords shows "The passwords do not match" under the confirmation, instead of `password_mismatch`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the error code for a password without an uppercase letter is spelled `password_uppercase_missing`. It was `password_uppercase_mmissing`; an API client that matched the misspelled code needs the new one.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a plugin the config adds replaces rime's default plugin of the same name. A hand-added `cache()` ran twice, with two clear-cache buttons in the panel header.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a read with `localeFallback: false` and a `depth` reads the related documents without fallback too, instead of filling their empty fields from the default locale.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a list read or a list delete refuses a `where` or a `sort` on a field the reader may not read (403), on a path into a related collection they may not read (403), or on a column that is no field (400). A filter could otherwise read a hidden value back one letter at a time.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `where` query string may nest an `or` inside an `and` and list up to 1000 ids, instead of answering 400 or 500, and `?where=foo` is refused as invalid data.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a radio given a second `options(...)`, on a clone for instance, starts on one of its new options. It kept the first option of the old list, and a new document's save answered 400.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `random.randomPassword` throws a `RangeError` for a length under 4, the one character of each kind it holds. It returned 4 characters, most of them fixed.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in a read-only document, the X of a select or link value is disabled and leaves the value alone.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in dev, a migration that rebuilds a table and leaves one of its columns out asks before it runs, as a dropped column does. The column's data was lost without a question.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a resolved reference sent as a number, such as `{ author: 42 }` or `{ author: { id: 42 } }` on an app's `text('author').$references('staff', { resolve: true })`, is refused with a 400 instead of silently clearing the stored reference.

- [`857f208`](https://github.com/bienbiendev/rime/commit/857f20888a880b5debd0c6c133c193113713deed) - Breaking Change: a save that names a document which does not exist is refused, with `relation_not_found` on the field, instead of the id being dropped from it. The check is one database query per relation field, run before anything is written. It replaces a fetch to `PUBLIC_RIME_URL` per document, which dropped the relation whenever the fetch failed, and the save then deleted its row. `rimecms/fields/relation/module` is gone.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a block render whose related document cannot be fetched shows its empty state, where the pick can be replaced. It showed a loading box until the page was reloaded.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a relation row whose locale changes, when its field becomes localized or stops being localized, is written with its new locale, instead of being updated again on every save.

- [`857f208`](https://github.com/bienbiendev/rime/commit/857f20888a880b5debd0c6c133c193113713deed) - Fixed: a relation left from a deleted block no longer makes up a block on read when it sits in a group inside that block.

- [`857f208`](https://github.com/bienbiendev/rime/commit/857f20888a880b5debd0c6c133c193113713deed) - Fixed: deleting block 1 no longer deletes the relations of blocks 10 to 19, and a save of one field no longer reaches the relations, blocks or tree rows of another whose name starts the same, `image` and `images`, `nav` and `navigation`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: saving relations deletes the right rows. A row was kept when the same document arrived at another block index or a field whose name read like its path, and a relation sent as a bare id could take the row another relation named by `id`, losing one of the two.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a relation that lists the same document twice stores it twice, instead of keeping one row.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: two relation fields with the same name and different targets, in two blocks of one collection, both keep their target. The junction table had a column for one target only, and the other field's relations were saved pointing at nothing.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a relation sent back with its row `id` and another document saves that document. It kept the old one, with no error.

- [`857f208`](https://github.com/bienbiendev/rime/commit/857f20888a880b5debd0c6c133c193113713deed) - Fixed: a relation write that fails fails the save. It was logged, and the save went on without the rows.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `RenderRichText` renders a line break as `<br>` and a horizontal rule as `<hr>`, and keeps the text of a mark it has no component for, without the mark. All three were left out of the page.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: in a collection list, a tree cell counts every item, children included, as "items", and a blocks cell reads in the panel language.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: blocks and tree items remember being open under one shared key, so each opens closed once after the update.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: a log line is `22:56:00.031 message`, written in order to one file per local day. A request line carries its status, `200 GET /panel/pages`, coloured by status on the terminal; in dev it goes to the file only, as SvelteKit prints every response itself. A warning starts with `[warn]`, an error with `[error]`, coloured on the terminal, and an error is printed with its stack. The CLI, codegen and schema steps log at `debug`, which the CLI always shows.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: every required column gets a default its type can hold, so adding a required `select`, a required field with a function default, or a required field from a package to a collection that has rows migrates. The migration failed with "Cannot add a NOT NULL column with default value NULL".

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the reset-password page enables its button only when the two passwords match, and asks for a password as strong as the staff form does.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `DELETE /api/<collection>` without a `where` filter answers 400 and deletes nothing, instead of deleting every document the caller may delete. An empty id in a client's URL (`DELETE /api/pages/`) no longer empties the collection. The local API's `delete()` with no query is unchanged.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the rich text bubble menu shows a mark as active right after a shortcut toggles it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a duplicated rich-text title gets its " (copy)" after its last text, also when an empty paragraph, a rule or a line break follows it. It used to land in a new paragraph.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the rich text drag handle finds a block that starts right of the middle of the window.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: with two `fields()` or two `upload()` features on a rich text, each palette entry inserts its own node instead of the last one registered.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `heading()` without levels gives all six heading levels, instead of none.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: rich text copied to the other locales, on a duplicate or a new version, reads back as written instead of empty.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an upload or resource node in rich text keeps the document it points at on a new version and on a duplicate. Only the rows of the document — blocks, tree items, relations — lose their ids to be written anew.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: copying and pasting a rich text `fields()` or `upload()` node keeps its values, instead of `[object Object]`, and a pasted upload node keeps its own upload type.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the rich text resource dialog searches the documents by their title, and the three pick dialogs say "Nothing found" in the panel language.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich text stored as a plain string opens as a paragraph in the panel and reads back as that text. It opened empty, and its cell and title showed it wrapped in quotes.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a required rich text with an empty editor is reported missing. An empty paragraph counted as content.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a resource in rich text follows its document. A rich-text resource node stores the document's `id`, and a read fills `title`, `_type` and `_thumbnail` from the document as the reader sees it now: its thumbnail is the current one after `rime uploads:move`, and a document the reader may not read gives `null` for all three instead of its title and thumbnail.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich text `resource()` node stores the picked document's own `_type`, not the feature's `source` with its query.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich text given two features that make the same node type, such as two `upload()` of one collection or two `fields()` of one name, is refused at boot. The editor kept one of them and warned in the console.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich text sent as a JSON string has its script links removed before it is saved, like a rich text sent as a document.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: rich text keeps its text as typed. `a < b and c > d` or `Use the <div> tag` were rewritten as markup on save.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: reading a rich text turns only a text node's `text` into a string. An empty `text` field inside a rich-text node, such as a fields node, read back as `"null"`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `RichText.toText` keeps a word with a mark on part of it whole ("Rethink", not "Re think"), and the list cell adds "..." only to a text it cut.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich-text link whose `href` runs script (`javascript:`, `vbscript:`, `data:`) loses its `href` when it is saved, and `RenderRichText` leaves out such an `href` stored before this fix.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a rich text that holds a node or mark type its field does not offer opens read-only in the panel, with a notice naming those types. The editor opened it empty, and the first edit saved over the stored text.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an image in rich text follows its media. A rich-text upload node stores the media's `id` and its `legend`, and a read fills `url`, `sizes`, `title`, `mimeType` and `filename` from the media as it is now. After `rime uploads:move` or a privacy change, its URL is the media's current one, and a private media's image goes only to callers who may read it: for anyone else those attributes are `null`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: route generation writes the app's `src/routes/+layout.server.ts` only when the app has no root layout server. It overwrote the app's own on every config change in dev. The written file says that rime's `LiveEdit` reads `user` from it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: on the panel and API routes, `event.params.slug` stays the slug the URL carries (`medias-directories`). `rime.routes.slug` gives the prototype it names (`$mediasDirectories`).

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an `id`, `ownerId` or `locale` in a document's data is ignored by the rows a write touches. An update keeps its row's key and owner, a locales row stays on the document and locale it was written for, a saved block stays on its document and locale, and a second locale written with the document's `id` in the body is saved instead of answering 500. An update answers the document it wrote, not the one an `id` in the body names. A folder of an upload collection still moves when its path changes, with its sub-folders and their files.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a block or tree item reads with every field of its own, empty when nothing is stored, as the document does: a hero block with no image reads `image: []` instead of having no `image` key. A row's bookkeeping (`path`, `position`) is still left out of a read outside the panel.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `string.sanitize` escapes attribute values, so a quote in an `href` can no longer open an event handler. It also drops an `href` whose script scheme hides behind spaces or control characters (`" javascript:"`), and keeps a link's `target` (it kept `_target`).

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a config file that imports or re-exports a file with `$` properties (an `index.ts` barrel) gets a server copy pointing at the server halves. The server read the panel's copy, without `$url`, `$hooks` or `$beforeSave`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `$` member written as a method, `$url(doc) { … }`, or with a quoted key, `'$url': …`, is removed from the panel's copy of the config, with what only it reads. It used to ship to the browser, and a `.server` import it read failed the panel build.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `.js` file under the config folder is split like a `.ts` file. Its `$` members, such as `$url` or `$hooks`, and the constants only they read, stay on the server instead of reaching the panel's public JavaScript.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `string.sanitize` keeps the text around a `<` that opens no tag. `1 < 2` came out as `1  2`; it now comes out as `1 &lt; 2`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a config constant used both in a `$` property and elsewhere stays in the panel's copy of the config. It was removed, and the panel threw a ReferenceError.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `string.sanitize` drops a U+E000 character the input holds, which it used to turn into a space.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: after a save or an auto-save that got no answer (a dropped connection), the document can be saved again without reloading the page. The failure shows as an error toast.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: on a document with versions and no drafts, each save from the panel, the document page and live edit alike, makes a new version instead of overwriting the one on screen.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the generated schema is found when the project path holds `.ts` in a folder name.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: selecting a blocks or tree field whose name holds `_` reads only its own relations. `?select=my_list` also loaded the relations of a sibling field such as `myXlist`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the select and combobox searches find an option by the label it shows, not only by its stored value.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `?select=title, attributes.slug` reads the names with the spaces around each comma trimmed, so a name after a space selects its field.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a select refuses a value that is not one of its options as a string, a list on a single select, and an option listed twice on a `many` select, which stored a document the panel could not open.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a select, radio or combobox with no option is reported by config validation, naming the field and its collection or area.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the server `rime build` writes no longer crashes when a visitor leaves while a static file is still loading.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a session whose user document was deleted is read as anonymous. Every request from that browser, public pages included, answered 401.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: deleting a media keeps its file while another document uses it, whatever the caller may read.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: type generation refuses two blocks or trees with one name and different fields, and names the type. The first one's type was written for both, so a collection type-checked against another collection's block.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a public sign-up follows the auth collection's own `create` rule, and only goes to an auth collection of `password` type. It created its document as rime, in any collection its `type` named.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a request that sends `authUserId` itself can no longer create an auth document linked to an existing better-auth account. Only better-auth's own sign-up takes that path. An API-key document posted with an `authUserId` gets its key, where it was saved without one.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `?skipValidation=true` only lets a staff request leave required fields empty. Field hooks, sanitizers, `validate`, unique and the relation check always run, so a caller can no longer store a `javascript:` link or raw HTML by adding the parameter. A required field left empty takes its default. Without one it is not written, instead of being written `''`: a create leaves the column to its own default, and an update keeps the column's stored value.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: changing a page's slug runs the collection's `beforeOperation` hooks, its access rule included, and its `afterUpdate` hooks on the page with its new url, so a guard, a cache purge or a webhook placed there sees a slug change as it sees a save.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the mailer opens TLS at once on port 465 only, so an SMTP server on 587 or 25 works through STARTTLS. `$smtp.secure` sets it for any other port. A failed mail still answers "Error while sending mail", and the server log now shows the transport's error, which the `mail_error` carries as its `cause`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `state.snapshot` copies a value that holds itself instead of overflowing the stack, and keeps a class instance as it is instead of turning it into a plain object.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `Date` inside a list that a `beforeRead` hook adds to a document reads as that date instead of `{}`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: in the SQLite adapter, a relation to a collection whose slug holds `Id` (`productIdeas`) reads back with the right `relationTo`, and a query on a property of a relation to a camelCase slug no longer fails. A field named `paid`, `valid` or `grid` no longer removes its table's primary key.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a server-sent events client that stops reading is dropped once 100 frames wait for it, instead of the server queueing every event and keep-alive in memory until it disconnects.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a server-sent events listener that throws is logged, and the other listeners on the same stream still hear the event.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: two `openSse` calls with the same handler are two listeners: unsubscribing one leaves the other listening.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: calling the unsubscribe `openSse` returns a second time does nothing. It used to take a newer stream on the same keys out of the shared list, so the next `openSse` on those keys opened a second `EventSource`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a staff member who is not an admin can create a user in a collection that allows it, and can no longer list or delete accounts through `/api/auth/admin/*`, which skipped rime's access rules. The `roles` field of a collection other than staff can only be changed by staff.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the labels given to staff roles (`staff: { roles: [{ value: 'editor', label: 'Editor' }] }`) show in the roles select.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the staff `update` rule lets a staff member update their own document, and never a user of another auth collection sending their own id.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `rime generate` run that died no longer stops dev codegen once its process id is reused. Its marker counts as stale after ten minutes, and when dev codegen does step aside for a run, it says so in a warning.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a system update of the super-admin (`rime.collection('staff').system().updateById(…)`) goes through, whoever made the request. It was refused unless the request's own user was the super-admin.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `.system()` create, update or media delete runs as rime to the end. Its reread, the original document and the upload cleanup were read as the request user, so an anonymous request answered 403.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: a `.system()` read returns every field, including the ones the request user may not read, and reads its relations, thumbnail and link urls as rime. An app that answers such a read picks the fields it sends.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: config validation refuses a tab named like a field at the same level, as it refuses two fields of one name. Both wrote to the same key of the document.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a tab without a label reads its name capitalized, `tab('seo')` reads "Seo", as a field does.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: on a declared table handle (`rime.adapter.table(…)`), a `null` value in `where` finds the rows that hold none, and a `select` naming a column the table does not have is refused with the column's name. The `null` filter matched nothing, and the unknown column threw a `TypeError`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a tab remembered by its name that no longer exists opens the first tab, instead of showing no tab.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `validate.tel` takes a number written with dots, dashes or parentheses, such as `+33 (0)1 23-45`, and refuses one with no digit, such as `'   '` or `'+++'`. A `+` is only accepted at the start.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a document whose thumbnail media the reader may not read is still listed, with no `_thumbnail`. A list dropped it without an error.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a time field refuses a one-digit hour, such as `8:00`, which the panel's time input cannot show. Write `08:00`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a tree item's ⋯ menu shows when its header is hovered or focused.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: deleting a nested tree item clears that item's errors, so Save is enabled again.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: saving a tree writes only the items that changed, instead of every item on every save.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: two tree fields shown together keep their drag lists apart, and a drop that would take an item's deepest child past `maxDepth` is refused instead of hiding that child from the form.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a block whose `type` the blocks field does not declare is left out of the save instead of answering 500.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `.unique()` field is checked on the value its `beforeSave` hooks leave, the value the save writes, so a duplicate answers 400 under the field instead of a database error.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the unique check looks up the value as sent. A value with `+`, `&` or `%` (`a+b`) was read as another value (`a b`), passed the check, and the save failed on the database's unique constraint. An empty value is no longer looked up.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Changed: a list sorted on a field that is not a column is refused, like a filter with an unknown operator. `?sort=titel` used to answer the list ordered by creation date, hiding the typo.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a field the reader may not see is left out of the answer only. The document an `afterUpdate` or `afterCreate` hook was handed keeps it, at any depth.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a document without a title reads "Untitled" in the panel language in the list, grid, tree, dashboard and breadcrumbs, instead of `[untitled]`. The delete dialog names the document.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the adapter's `updateWhere` reads a filter on a localized field in the locale it writes, and refuses a filter that keeps every row, such as an empty `and`. The localized filter matched nothing, and the empty filter updated every row.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an upload collection with `accept` refuses a file of another type when it is picked or dropped, with a toast and a field error, instead of at save. The file chooser offers the accepted types only.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an upload document's files are removed after the write, and only when no row uses them any more. Replacing the file of one version removes that version's old file and leaves the files of the other versions; replacing a file in a new version saves it once and keeps it; deleting a versioned document removes the files of all its versions; `file: null` clears `filename`, `mimeType` and `filesize` with the sizes; the image sizes of a file already missing are removed too.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: dropping text or a link on the upload drop zone no longer leaves the document form disabled until a reload.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a file without an extension (`README`) is saved as `readme` instead of the hidden file `.readme`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an upload's stored file name never reaches a file outside `static/medias`. A request cannot write `filename` or an image size column, which the saved file sets; a stored name with a folder, `.` or `..` in it is refused, so a delete removes nothing outside the folder and a new version copies no file from outside it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an upload whose folder cannot be created fails with the folder's error, instead of landing in `root` with a 200. A folder another upload creates at the same moment is used as it is.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an upload named in a non-Latin script, such as `日本.jpg`, is saved as `file.jpg` instead of the hidden file `.jpg`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an image size named with a dash (`large-square`) reaches `doc.sizes.largeSquare`, and its generated type is valid TypeScript. Size names are camelCased once, when the config is built.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: uploading the same image twice reuses its existing sizes, width-only sizes such as `thumbnail` included, instead of writing every size again.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: an admin or staff member creating a user without a password gets a form error on `password`. The user was created with no password and could never sign in.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a field's `.validate()` adds a rule after the field's own check instead of replacing it, so `number('age').min(0).validate(...)` still refuses `-5`, and an email, a checkbox or a select with a rule still refuses a value of the wrong kind.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `validate.link` refuses a value that is not a link object with `invalid_field`, instead of throwing on `null`.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: saving a version checks the update right only. It also asked for `create` on the versions collection, so an editor who may update but not create got 403.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a filtered `find` with `limit` or `offset` on a collection or area with versions pages the documents that match. It cut the page first and filtered after, so matches past the first rows were missing.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a versioned list sorted on a content field is ordered by the version each document shows. It was ordered by the newest version, so an unpublished draft or an auto-save decided where a published document stood.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a version row cannot be created or updated through `/api/<collection>--versions` any more, which let a `PATCH` publish a draft beside the published version. A version is made and changed through its document. Reading and deleting version rows is for staff the document allows: a caller who is not staff now gets 403 on a delete, even when the document's `delete` rule allows them.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: the `between` and `not_between` filters take their two bounds, as `1,10` in a URL or `[1, 10]` in code, and `ilike` runs on SQLite. `between` matched nothing and `ilike` answered 500; a range that is not two values is refused.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a filter with several fields, or several operators on one field, applies all of them. `where[status][equals]=published&where[category][equals]=x` and `{ price: { greater_than: 1, less_than: 10 } }` kept only their first condition.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a filter value is read as the type of the column it is compared to. A text field keeps the value as sent, so `007`, `1e3`, an empty value or a date-like text are found, and a localized field matches a number-like value. A number, boolean or date column still reads the string as its type, a date column refuses a value that is not a date, and `in_array` takes a single value from code.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a `versionId` filter on a versioned list answers the document that holds that version. It answered nothing, because the filter was rewritten in place and read a second time.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a filter on a field of a related versioned document, such as `?where[category.title][equals]=News` with versioned `categories`, finds the documents whose related document has a version holding the value, a draft included. It found none.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: `?versionId=` and `?latest=true` on a write or a duplicate are staff's to name, as on a GET. From anyone else, a PATCH targets the published version and a duplicate copies it, so a draft or an auto-save no longer reaches a caller who cannot read it.

- [`402a993`](https://github.com/bienbiendev/rime/commit/402a9932ce2c0eb6e98dbc08bea353ba79ef7cc0) - Fixed: a create or update the caller may write but not read answers `{ doc: { id } }` instead of 403 after the row is written, and leaves out the fields they may not read. The afterCreate and afterUpdate hooks get the whole document.

## 1.1.6

### Patch Changes

- [`7a2b831`](https://github.com/bienbiendev/rime/commit/7a2b831dfcbaa1ff5b267c6a73b84b82053701c3) - Changed: the generated schema no longer exports `relationFieldsMap`, and the SQLite adapter no longer has a `relationFieldsMap` property. Nothing read them.

- [`a0d4186`](https://github.com/bienbiendev/rime/commit/a0d41863f24f1faa626f151bda8c66e50c514b1a) - Fixed: a relation field stays a relation after a dev reload that loads its code twice. The schema generator no longer takes it for a text column, which dropped its junction table and every relation in it.

## 1.1.5

### Patch Changes

- [`276100f`](https://github.com/bienbiendev/rime/commit/276100f7c941876ce2b9ecfbf8e515952104aea5) - Fixed: a rich text with several `resource()` features inserts the one picked in the menu; each inserted the last one declared, so `resource({ source: 'pages' })` listed medias when `resource({ source: 'medias' })` came after it.

- [`15f6344`](https://github.com/bienbiendev/rime/commit/15f63447586dc3a08ef0bddaa7fb856f0061cfb0) - Changed: a relation to an upload collection that takes one document shows its pick as a card in the drop zone's place: the image, the name, linked to the media, its size and type, a button to upload another file and one to remove it. A file dropped on the card replaces the pick. A field that takes several keeps the zone and the squares.

## 1.1.4

### Patch Changes

- Fixed: deleting several upload documents at once removes the file they share. The documents are deleted one after the other, so the last one finds no other document using the file and deletes it, with its sizes. A filename with `&` or `+` no longer breaks the check.

- Added: `find`, `findById` and `findByIds` of a collection, and an area's `find`, called with a literal `depth` return the documents typed with their relations resolved to that depth: `findById({ id, depth: 1 })` types `page.hero.thumbnail` as `MediasDoc[]`.

- Fixed: in a collection's grid layout, a document with an `isThumbnail()` relation shows the image instead of the collection's icon.

- Fixed: a relation's list default is stored in the order it is written, not in the order of the last update of its documents.

- Fixed: in the panel, a relation's default shows as picked: a create form no longer throws on it, a new block's relation no longer shows empty or loads forever, and a group preview no longer counts the characters of the id.

- Fixed: a relation fetched from a site page or a panel preview requests the API path, whatever the page's own path; it requested `api/…` relative to the page, a 404 under `/panel/pages/<id>` or `/fr/…`.

- Breaking Change: `isRelationPopulated`, `isRelationResolved`, `isRelationUnresolved` and `resolveRelation` are replaced by `Relation`, from `rimecms/public`. `Relation.resolve(value).first()` and `.all()` give the documents a relation holds: at once when the value already holds them, a promise when refs have to be fetched, so `{#await}` server-renders a page read at depth 1. `Relation.isRef(entry)` tells a ref from a document. Before: `{#await resolveRelation(block.image).then((r) => r?.at(0)) then image}`. After: `{#await Relation.resolve(block.image).first() then image}`.

- Fixed: in the panel, a related document that no longer matches the field's `query()` stays in the field instead of being dropped by the next change.

- Fixed: a document read with its relations resolved and saved back keeps its relations; they were deleted, on a versioned collection too.

- Breaking Change: `RelationValue<T>` is what a read answers, `T[] | RelationRef[]`; a bare id no longer types as a read value. A write takes `RelationInput<T>`, which adds `string | string[]`: `create` and `update` data are typed with it, and so are a relation field's hooks.

- Fixed: a relation sent as `[null]` with `?skipValidation` no longer answers 500, and one ref sent outside an array is no longer read as empty, which deleted the relation.

- Breaking Change: `richTextJSONToText(value)` is `RichText.toText(value)`, from `rimecms/public`.

- Breaking Change: `WithRelationPopulated<T>` is `WithRelationResolved<T, D>`, `D` the depth, 1 by default. It walks blocks and trees, which it took for relations before, so a relation inside a block is typed resolved too.

## 1.1.3

### Patch Changes

- [`4739d1b`](https://github.com/bienbiendev/rime/commit/4739d1b38ea347498557ef1dbbbe4600e994bd51) - Fixed: in focus mode, a long block title in the layers ends in an ellipsis instead of widening the panel.

- [`4739d1b`](https://github.com/bienbiendev/rime/commit/4739d1b38ea347498557ef1dbbbe4600e994bd51) - Changed: in focus mode, a nested list has a `+` after its blocks that adds one at its end. An empty list always shows it; a list with blocks shows it while its block, or one of its own blocks, is selected. A click beside the blocks of a nested list selects the block that holds it, its fields in the inspector, and no longer the list alone. Under the stage, _Add a block or type /_ is a button.

- [`4739d1b`](https://github.com/bienbiendev/rime/commit/4739d1b38ea347498557ef1dbbbe4600e994bd51) - Changed: in focus mode, a list that takes one block type adds it at once from `/`, a `+` or the button under the stage, without opening the picker.

- [`4739d1b`](https://github.com/bienbiendev/rime/commit/4739d1b38ea347498557ef1dbbbe4600e994bd51) - Added: `children('items', { class: 'cards' })` names the wrapper of a nested list in a block's render, so the render lays it out, the list's `+`, `.rz-renders__add`, included.

- [`4739d1b`](https://github.com/bienbiendev/rime/commit/4739d1b38ea347498557ef1dbbbe4600e994bd51) - Added: `block('button').render(Render, { controls: false })` drops the bar above the block when it is selected in focus mode, for a small block. Keys, ⌘K and the layers still move, duplicate and remove it.

## 1.1.2

### Patch Changes

- Changed: a default value is what a new document starts with, and no longer what an empty value turns back into. A field not sent on a create gets its default; a field sent empty stays empty, and an empty value reads empty instead of its default. `defaultValue(value, { fill: 'save' })` also gives an empty value its default on every save, and `required` no longer fills a field. `blocks()` and `tree()` take a `defaultValue()`, and a block inserted in the panel starts with the default of its nested lists. An area's first boot writes its default blocks, tree items and relations too. A new version keeps a field cleared on purpose. A checkbox counts `false` as a value. `blank()` is renamed `initial()`.

- Added: in focus mode, a block's nested list takes new blocks without a drag. A click beside the blocks of a nested list selects it, and `/`, ⌘K, the Blocks tab and paste add at its end. The inspector's list rows have a `+` that opens the picker on that list. The "Type / to add a block" prompt sits at the end of the list the next block goes to, so the stage shows only one.

## 1.1.1

### Patch Changes

- Fixed: a generated block type has `type` once, the block's name: `type: 'card'`, where a second `type?: string` used to win. A list of blocks narrows on `block.type`, and a block is a `GenericBlock`.

- Fixed: closing a dialog, the ⌘K palette or the relation picker, no longer warns `derived_inert` in the console when the focus has nowhere to go back to. `bits-ui` goes from 2.8.0 to 2.19.3; a command dialog still opens on its first line.

- Fixed: `rimecms/public` imports outside a SvelteKit page, in a component spec. `LiveProvider` loads `$env/dynamic/public` with the first message from the panel, not on import.

- Fixed: `isRelationPopulated` answers `false` for `undefined`, `null`, and anything that is not a non-empty array of documents.

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
