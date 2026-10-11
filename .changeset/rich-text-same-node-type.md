---
'rimecms': patch
---

Fixed: a rich text given two features that make the same node type, such as two `upload()` of one collection or two `fields()` of one name, is refused at boot. The editor kept one of them and warned in the console.
