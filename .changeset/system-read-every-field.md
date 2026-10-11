---
'rimecms': patch
---

Changed: a `.system()` read returns every field, including the ones the request user may not read, and reads its relations, thumbnail and link urls as rime. An app that answers such a read picks the fields it sends.
