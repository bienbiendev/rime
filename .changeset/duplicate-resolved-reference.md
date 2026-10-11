---
'rimecms': patch
---

Fixed: duplicating a document keeps a reference read as a document (`$references(…, { resolve: true })`). The copy saved it empty.
