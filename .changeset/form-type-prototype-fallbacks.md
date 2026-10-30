---
'rimecms': patch
---

Fixed: a document form opened on a new document, like the "New folder" dialog of an upload collection, holds `_type: '<slug>'` and `_prototype: 'collection'`, where the two values were swapped.
