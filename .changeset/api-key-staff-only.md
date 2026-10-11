---
'rimecms': patch
---

Fixed: an api key is refused to a signed-in user who is not staff before the key is made. The key was created and mailed, then its document failed to save, which left a live key with no document to revoke it.
