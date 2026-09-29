---
'rimecms': minor
---

Added: the Bun pack. `rime init --bun` writes `adapterSqlite('app.sqlite', { driver: 'bun' })`, which opens the database with `bun:sqlite`, installs `svelte-adapter-bun` as the SvelteKit adapter, and prefixes the app's vite scripts with `bun --bun`. `rime build` detects those scripts (or takes `--bun`) and writes an `index.js` over the adapter's handler that also serves `./static`, where uploads land: run it with `bun index.js`. Migrations still go through drizzle-kit. `SqliteAdapter['db']` is now typed `SqliteDatabase`, which covers both drivers.
