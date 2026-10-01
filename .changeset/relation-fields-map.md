---
'rimecms': patch
---

Changed: the generated schema no longer exports `relationFieldsMap`, and the SQLite adapter no longer has a `relationFieldsMap` property. Nothing read them.
