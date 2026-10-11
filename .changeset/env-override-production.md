---
'rimecms': patch
---

Fixed: a variable the environment sets, `PORT` from the platform or the command line, is no longer overwritten by the one in `.env`.
