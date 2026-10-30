---
'rimecms': patch
---

Fixed: a new version of an upload document reads the file it inherits without blocking the server, so other requests are answered while a large file is read.
