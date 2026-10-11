---
'rimecms': patch
---

Fixed: `string.sanitize` keeps the text around a `<` that opens no tag. `1 < 2` came out as `1  2`; it now comes out as `1 &lt; 2`.
