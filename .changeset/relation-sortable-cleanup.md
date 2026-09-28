---
'rimecms': patch
---

Fixed: a relation field or a select field with many values no longer throws "Instance exist. Should never happen." when its list re-renders: the drag and drop is torn down before it is set up again, and dragging the picked chips reorders them.
