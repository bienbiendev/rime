---
'rimecms': patch
---

Fixed: deleting an API key document removes its key, whoever created it, and the key stops authenticating. A key document that holds no key no longer deletes the account of the user who created it.
