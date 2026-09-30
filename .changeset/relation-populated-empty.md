---
'rimecms': patch
---

Fixed: `isRelationPopulated` answers `false` for `undefined`, `null`, and anything that is not a non-empty array of documents.
