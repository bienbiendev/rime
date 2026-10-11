---
'rimecms': patch
---

Fixed: `DELETE /api/<collection>` without a `where` filter answers 400 and deletes nothing, instead of deleting every document the caller may delete. An empty id in a client's URL (`DELETE /api/pages/`) no longer empties the collection. The local API's `delete()` with no query is unchanged.
