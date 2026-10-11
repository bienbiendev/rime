---
'rimecms': patch
---

Fixed: a `tabs()` inside a group, block, tree item or tab reads and writes its fields at their own path (`meta.seo.title`). It used `meta..seo.title`, so stored values showed empty and an edit was saved under an empty key.
