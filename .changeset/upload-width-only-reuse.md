---
'rimecms': patch
---

Fixed: uploading the same image twice reuses its existing sizes, width-only sizes such as `thumbnail` included, instead of writing every size again.
