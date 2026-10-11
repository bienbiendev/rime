---
'rimecms': patch
---

Fixed: a new version of a localized document keeps the edit that made it in the fields every locale shares, and keeps its blocks after a reorder. Copying the other locales onto a new version or a duplicate writes only their localized values; a localized field inside a shared block takes the other locale's value when the block at that position has the same type, and falls back on read otherwise.
