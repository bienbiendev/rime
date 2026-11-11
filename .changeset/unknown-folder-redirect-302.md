---
'rimecms': patch
---

Fixed: an upload list page opened on a folder that does not exist (`?uploadPath=root:missing`) lands on the list's root, and any other failure to read the folder shows as an error instead of a redirect.
