---
'rimecms': patch
---

Fixed: in the panel, a list refreshed twice in a row keeps the answer of the newest refresh. A version history refreshed by an auto-save and then by a save could show the older answer, without the new version, until its next refresh.
