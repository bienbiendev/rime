---
'rimecms': patch
---

Fixed: config validation refuses a tab named like a field at the same level, as it refuses two fields of one name. Both wrote to the same key of the document.
