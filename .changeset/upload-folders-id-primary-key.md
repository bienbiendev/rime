---
'rimecms': minor
---

Breaking Change: an upload collection's folders table keys its `id`, the folder path, with the same primary key as every other table. Run `rime generate`, then migrate, to apply it.
