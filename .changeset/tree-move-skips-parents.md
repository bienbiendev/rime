---
'rimecms': patch
---

Fixed: a move in a nested collection's tree saves the moved page and the siblings it renumbers, not its old and new parents, whose `updatedAt` and save hooks stay as they were.
