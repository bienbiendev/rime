---
'rimecms': patch
---

Fixed: a `.unique()` field is checked on the value its `beforeSave` hooks leave, the value the save writes, so a duplicate answers 400 under the field instead of a database error.
