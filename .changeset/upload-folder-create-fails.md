---
'rimecms': patch
---

Fixed: an upload whose folder cannot be created fails with the folder's error, instead of landing in `root` with a 200. A folder another upload creates at the same moment is used as it is.
