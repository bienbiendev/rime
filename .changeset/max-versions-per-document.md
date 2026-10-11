---
'rimecms': patch
---

Fixed: `maxVersions` keeps the newest versions of each document. It counted the whole versions table, so saving one document deleted other documents' versions, sometimes a document's only version, which then read as missing. `maxVersions` defaults to 12, so every collection or area with versions was affected.
