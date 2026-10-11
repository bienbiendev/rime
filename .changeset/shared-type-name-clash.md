---
'rimecms': patch
---

Fixed: type generation refuses two blocks or trees with one name and different fields, and names the type. The first one's type was written for both, so a collection type-checked against another collection's block.
