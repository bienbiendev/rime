---
'rimecms': patch
---

Fixed: following a link with a query string inside live edit stays in live edit (`/news?page=2` becomes `/news?page=2&live=1`, not `/news?page=2?live=1`).
