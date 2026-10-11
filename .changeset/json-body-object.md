---
'rimecms': patch
---

Fixed: a JSON body that is not an object, such as `null` or `[]`, answers 400 instead of a 500 or a document made of defaults.
