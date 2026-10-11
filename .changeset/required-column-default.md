---
'rimecms': patch
---

Fixed: every required column gets a default its type can hold, so adding a required `select`, a required field with a function default, or a required field from a package to a collection that has rows migrates. The migration failed with "Cannot add a NOT NULL column with default value NULL".
