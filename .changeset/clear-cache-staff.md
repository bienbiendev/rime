---
'rimecms': patch
---

Fixed: `POST /api/clear-cache` answers 403 to anyone who is not staff. It emptied the API cache for any caller.
