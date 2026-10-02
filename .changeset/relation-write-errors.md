---
'rimecms': patch
---

Fixed: a relation write that fails fails the save. It was logged, and the save went on without the rows.
