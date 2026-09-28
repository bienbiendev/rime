---
'rimecms': patch
---

Fixed: a tabs field no longer reads `localStorage` while the page renders on the server, which made Node 25 and later warn that `--localstorage-file` was not provided.
