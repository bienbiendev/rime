---
'rimecms': minor
---

Changed: a link to a document carries its target's `id`, `url` and `title` at every depth, `depth=0` and a link to its own document included. The target is read in the read's locale with only those selected, through its own read rules: a target the reader may not read, one never published, or one with no url gives none of the three. The save stores none of them, so a `url` sent with a document link is never shown. The panel's list cell shows the link's title.
