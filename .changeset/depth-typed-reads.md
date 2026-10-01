---
'rimecms': patch
---

Added: `find`, `findById` and `findByIds` of a collection, and an area's `find`, called with a literal `depth` return the documents typed with their relations resolved to that depth: `findById({ id, depth: 1 })` types `page.hero.thumbnail` as `MediasDoc[]`.
