---
'rimecms': minor
---

Changed: a document's url comes with its row: reading a list of nested pages no longer runs a query
per parent of every page, and a read no longer writes. Moving a page, or changing its slug, updates
the addresses of every page under it in one statement per locale.
