---
'rimecms': patch
---

Fixed: with the disk strategy, a cache key is stored under a hash of itself, so a key built from request input can no longer read or write a file outside `.cache/`.
