---
'rimecms': patch
---

Fixed: a config file that imports its folder's index as `from '.'` or `from '..'` reads the server half of that index on the server, with its `$` properties, when the index holds server-only content.
