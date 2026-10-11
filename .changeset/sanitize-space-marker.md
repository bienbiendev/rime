---
'rimecms': patch
---

Fixed: `string.sanitize` drops a U+E000 character the input holds, which it used to turn into a space.
