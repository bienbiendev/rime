---
'rimecms': patch
---

Fixed: saving an upload document in the panel no longer moves it to the root folder when its page was opened from a relation field, the dashboard or a search. An existing document stays in its own folder, and its breadcrumb shows that folder; `?uploadPath` only names the folder a new document goes in.
