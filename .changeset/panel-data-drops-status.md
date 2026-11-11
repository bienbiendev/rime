---
'rimecms': minor
---

Breaking Change: the panel page data no longer carries `status`, which was always `200` and set nothing. `CollectionProps`, `CollectionDocData` and `AreaDocData` drop their `status` field, so a page that reads `data.status` stops compiling: remove the read.
