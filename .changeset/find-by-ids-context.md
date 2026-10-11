---
'rimecms': patch
---

Fixed: `findByIds` hands the context its `beforeOperation` hooks return to the `beforeRead` hooks, as `find` and `findById` do.
