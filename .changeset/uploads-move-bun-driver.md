---
'rimecms': patch
---

Fixed: `rime uploads:move` works on a project whose adapter uses `driver: 'bun'`. Like `rime generate`, it opens the database with libsql on Node, instead of failing with "adapterSqlite driver 'bun' needs the Bun runtime".
