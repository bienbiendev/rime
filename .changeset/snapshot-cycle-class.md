---
'rimecms': patch
---

Fixed: `state.snapshot` copies a value that holds itself instead of overflowing the stack, and keeps a class instance as it is instead of turning it into a plain object.
