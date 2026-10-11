---
'rimecms': patch
---

Fixed: a list read or a list delete refuses a `where` or a `sort` on a field the reader may not read (403), on a path into a related collection they may not read (403), or on a column that is no field (400). A filter could otherwise read a hidden value back one letter at a time.
