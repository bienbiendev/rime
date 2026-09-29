---
'rimecms': patch
---

Fixed: with `depth`, a related document that is missing or that the reader may not see is left out
of the relation. It used to drop the whole document from a list, or fail a read by id.
