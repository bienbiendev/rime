---
'rimecms': minor
---

Breaking Change: the SQLite database and its migrations move from `db/` to `storage/sqlite/` at the project root, beside the uploads, where no URL reaches. Run `rime db:move` once, with the server stopped: it moves the folder, points the paths of `drizzle.config.ts` that name `db/` at `storage/sqlite`, and adds `/storage` to `.gitignore` when no line covers it. A server that keeps its database in a deployed `app/` runs it there too. `rime build -w` (`--with-storage`) copies all of `storage/` to `app/storage/`: the database as well as the uploads, so a deploy that copies `app/` over replaces its database with the local one. Use it in place of `-d`, which is gone, and never to ship only the uploads to a server that keeps its own database. `-s` now copies `static/` alone, without the uploads. `rime build -w` refuses a project whose database is not in `storage/sqlite/` yet, and names `rime db:move`. `rime init` takes `--adapter`, `sqlite` by default.
