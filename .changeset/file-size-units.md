---
'rimecms': patch
---

Fixed: an upload's stored `filesize` moves up a unit when it rounds to 1000, `1.00MB` instead of `1000.00KB`, and reads in GB past 1000 MB.
