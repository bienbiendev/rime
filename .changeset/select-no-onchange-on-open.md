---
'rimecms': patch
---

Fixed: opening a document in the panel no longer runs each select's `onChange`, so a hook that resets another field no longer empties it on load. A stored value that is no longer an option is still dropped.
