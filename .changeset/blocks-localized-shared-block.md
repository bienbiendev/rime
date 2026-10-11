---
'rimecms': patch
---

Fixed: `localized()` on a blocks list gives the list its own copies of its block types, and leaves a block shared with another list as it is. A document that holds the same block in a localized list and in another list is now refused by the config check, where the block used to turn localized in both.
