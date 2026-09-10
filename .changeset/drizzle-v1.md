---
'rimecms': minor
---

Drizzle ORM and Kit move to 1.0.0-rc.4.

**Your `db/` folder needs converting.** Drizzle 1.0 restructured it — `meta/_journal.json` is
gone and each migration's snapshot now sits beside its SQL. Rime detects the old shape and runs
`drizzle-kit up` for you on the next generate, but it rewrites files git is tracking, so commit
before upgrading.

The migrator also changed how it decides what to apply: every missing migration runs, matched by
full folder name rather than by timestamp order. A linear history is unaffected; one that has
merged branches may not be.

Both packages are pinned to the exact release, and `rime init` installs that same version — an app
on a different rc than the rimecms it installed is a split that fails at runtime, not at install.
