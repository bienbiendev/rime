---
'rimecms': patch
---

Fixed: `validate.tel` takes a number written with dots, dashes or parentheses, such as `+33 (0)1 23-45`, and refuses one with no digit, such as `'   '` or `'+++'`. A `+` is only accepted at the start.
