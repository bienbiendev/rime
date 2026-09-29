---
'rimecms': patch
---

Fixed: a rich text's resource and upload nodes open their picker when they are inserted, not every time the document loads. A node stored without `_fresh` opened its picker on load, each one over the last.
