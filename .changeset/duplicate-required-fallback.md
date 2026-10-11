---
'rimecms': patch
---

Fixed: a copy of a document first written in another locale takes, for each required field it has no value for in the default locale, the value a read shows there. Its title read `null (copy)`, and a required field left empty refused the copy.
