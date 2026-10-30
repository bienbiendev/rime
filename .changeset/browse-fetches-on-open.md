---
'rimecms': patch
---

Fixed: the media library of an upload relation reads its files and folders once it opens, where every form holding the field read the library's root on mount.
