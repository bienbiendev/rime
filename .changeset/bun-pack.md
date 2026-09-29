---
'rimecms': minor
---

Added: the Bun pack. `rime init --bun` writes `adapterSqlite('app.sqlite', { driver: 'bun' })`, which opens the database with `bun:sqlite`, and prefixes the app's vite scripts with `bun --bun`. `rime build` detects those scripts, runs the build on Bun, and writes the same `index.js` as the Node pack: run it with `bun index.js`. Migrations still go through drizzle-kit. `SqliteAdapter['db']` is now typed `SqliteDatabase`, which covers both drivers.
