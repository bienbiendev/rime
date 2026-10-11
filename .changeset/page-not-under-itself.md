---
'rimecms': patch
---

Fixed: moving a page under itself or under a page below it answers 400 before anything is written, instead of storing a `_parent` that loops and dropping both pages from the tree.
