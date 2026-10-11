---
'rimecms': patch
---

Fixed: a filtered `find` with `limit` or `offset` on a collection or area with versions pages the documents that match. It cut the page first and filtered after, so matches past the first rows were missing.
