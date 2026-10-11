---
'rimecms': patch
---

Fixed: a unique text or slug takes a free value on a copy: `Title (copy)`, then `Title (copy 2)`, and `my-page-copy`, then `my-page-copy-2`. The copy was refused as a duplicate value.
