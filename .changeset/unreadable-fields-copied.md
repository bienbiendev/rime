---
'rimecms': patch
---

Fixed: a field the reader may not see is left out of the answer only. The document an `afterUpdate` or `afterCreate` hook was handed keeps it, at any depth.
