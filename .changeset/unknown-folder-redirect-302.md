---
'rimecms': patch
---

Fixed: an upload list page opened on a folder that does not exist (`?uploadPath=root:missing`) redirects to the root with a 302 instead of a 301, so the browser does not keep redirecting once the folder exists. Any other failure to read the folder shows as an error instead of a redirect.
