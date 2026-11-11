---
'rimecms': patch
---

Fixed: moving a page in the tree of a nested collection saves only that page. Its old and new parents are not saved, and the pages around it keep their last-edited date and author, run no hooks and get no new version: only their place in the list is written. The list keeps the order dropped on screen, even for pages that shared a place.
