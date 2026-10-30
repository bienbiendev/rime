---
'rimecms': patch
---

Fixed: an upload document without a generated size, such as a PDF, no longer carries its empty size column (`thumbnail: null`) beside `sizes`.
