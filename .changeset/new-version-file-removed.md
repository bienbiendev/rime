---
'rimecms': patch
---

Fixed: removing the file of an upload document whose every save makes a new version leaves the new version with no file, instead of giving it the previous version's file back. The previous version keeps its file, on disk as long as a version names it.
