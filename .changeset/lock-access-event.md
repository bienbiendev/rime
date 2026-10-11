---
'rimecms': patch
---

Fixed: the edit-lock routes hand the request to the update access rule, as a save does, so a rule that reads `options.event` answers the same for the lock and for the save.
