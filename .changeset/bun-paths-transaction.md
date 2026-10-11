---
'rimecms': patch
---

Fixed: with `driver: 'bun'`, moving a page or refreshing its urls is all or nothing again. bun:sqlite committed the transaction before its updates ran, so a move refused in one locale stayed applied in the others.
