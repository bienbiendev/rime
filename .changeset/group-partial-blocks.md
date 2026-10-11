---
'rimecms': patch
---

Fixed: saving a group with only some of its fields keeps the blocks and tree items of the others, and the relations inside them. They were deleted, while the group's other values were kept.
