---
'rimecms': patch
---

Fixed: saving a group or a tab as `null` clears every value inside it, and a required field inside it answers its form error, as it does when sent empty. The previous values were kept.
