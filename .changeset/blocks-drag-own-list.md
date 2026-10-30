---
'rimecms': patch
---

Fixed: a block row drags within its own blocks list only. Two nested lists that had stood at the same path, such as the `items` of a grid that moved up after a delete and of a grid added in its place, shared a drag group: a row dropped in the other list moved a row of its own list instead.
