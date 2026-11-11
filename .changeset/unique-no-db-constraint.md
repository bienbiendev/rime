---
'rimecms': minor
---

Breaking Change: a `.unique()` field no longer writes a UNIQUE constraint on its column; the save checks it and answers 400 `unique_field`. The constraint collided across the locales of one document and could not hold on a versions table. Run `rime generate`, then migrate, to drop the constraints.
