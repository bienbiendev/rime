---
'rimecms': patch
---

Fixed: a config constant used both in a `$` property and elsewhere stays in the panel's copy of the config. It was removed, and the panel threw a ReferenceError.
