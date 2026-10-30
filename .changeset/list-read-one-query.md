---
'rimecms': patch
---

Fixed: a list read of a nested collection reads the children of all its documents in one query, and a list read of a collection with an `isThumbnail()` relation reads all their thumbnails in one query, instead of one query per document.
