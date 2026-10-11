---
'rimecms': patch
---

Fixed: a session whose user document was deleted is read as anonymous. Every request from that browser, public pages included, answered 401.
