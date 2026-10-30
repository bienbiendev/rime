---
'rimecms': patch
---

Changed: a `.unique()` field no longer writes a UNIQUE constraint on its column; the save checks it and answers 400 `unique_field`. The constraint collided across the locales of one document and could not hold on a versions table. An upload collection's folders table now keys its `id`, the folder path, with the same primary key as every other table. Run `rime generate` and the drizzle migration to apply both.
