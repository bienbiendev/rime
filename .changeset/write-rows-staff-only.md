---
'rimecms': patch
---

Fixed: `?versionId=` and `?latest=true` on a write or a duplicate are staff's to name, as on a GET. From anyone else, a PATCH targets the published version and a duplicate copies it, so a draft or an auto-save no longer reaches a caller who cannot read it.
