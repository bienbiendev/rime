---
'rimecms': patch
---

Fixed: in dev, a migration that rebuilds a table and leaves one of its columns out asks before it runs, as a dropped column does. The column's data was lost without a question.
