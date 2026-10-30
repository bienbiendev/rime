---
'rimecms': patch
---

Fixed: a save holds the document form until its redirect is done. A second ⌘S while the new API key's dialog is open, or during a slow redirect after a create, no longer creates the document twice.
