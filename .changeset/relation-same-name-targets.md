---
'rimecms': patch
---

Fixed: two relation fields with the same name and different targets, in two blocks of one collection, both keep their target. The junction table had a column for one target only, and the other field's relations were saved pointing at nothing.
