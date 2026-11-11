---
'rimecms': minor
---

Breaking Change: the collection handle of a database adapter has a `count({ query, content, locale })` method, which answers how many documents its `findMany` lists for the same arguments, one per document. A third-party `$adapter` written for 1.3 stops compiling, and fails on the first count, until its `collection(slug)` handle adds it. `adapterSqlite` has it.
