---
'rimecms': patch
---

Fixed: a new version of an upload document loads the file it inherits with a read that does not block the server. The check that follows, whether the stored file is the same, still reads it in one blocking read.
