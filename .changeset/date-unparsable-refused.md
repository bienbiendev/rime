---
'rimecms': patch
---

Fixed: a date field refuses a value that is not a date, such as `"soon"`, with a 400 naming the field. It answered 500 on libsql and stored `null` on bun:sqlite.
