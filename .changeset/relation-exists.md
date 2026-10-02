---
'rimecms': patch
---

Breaking Change: a save that names a document which does not exist is refused, with `relation_not_found` on the field, instead of the id being dropped from it. The check is one database query per relation field, run before anything is written. It replaces a fetch to `PUBLIC_RIME_URL` per document, which dropped the relation whenever the fetch failed, and the save then deleted its row. `rimecms/fields/relation/module` is gone.
