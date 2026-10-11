---
'rimecms': patch
---

Fixed: a block named with `_` or `-`, like `call_to_action` or `hero-banner`, keeps the validation, hooks and relations of its fields. A required field in it no longer refuses every save, and a relation picked in it is stored. A block name holding a `.` is refused by the config check.
