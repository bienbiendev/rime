---
'rimecms': patch
---

Fixed: a relation sent as `[null]` with `?skipValidation` no longer answers 500, and one ref sent outside an array is no longer read as empty, which deleted the relation.
