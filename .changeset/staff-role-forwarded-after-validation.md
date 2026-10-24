---
'rimecms': patch
---

Fixed: a staff save refused by validation no longer changes the member's better-auth role. Such a save can no longer give an editor better-auth admin rights, or lock an admin out of every request.
