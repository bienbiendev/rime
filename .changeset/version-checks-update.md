---
'rimecms': patch
---

Fixed: saving a version checks the update right only. It also asked for `create` on the versions collection, so an editor who may update but not create got 403.
