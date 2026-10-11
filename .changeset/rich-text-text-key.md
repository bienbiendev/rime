---
'rimecms': patch
---

Fixed: reading a rich text turns only a text node's `text` into a string. An empty `text` field inside a rich-text node, such as a fields node, read back as `"null"`.
