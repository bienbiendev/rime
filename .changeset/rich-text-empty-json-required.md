---
'rimecms': patch
---

Fixed: a required rich text sent as `{}` or `[]` is refused with `required_field`, as an empty document is, instead of being stored.
