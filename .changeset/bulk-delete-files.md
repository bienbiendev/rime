---
'rimecms': patch
---

Fixed: deleting several upload documents at once removes the file they share. The documents are deleted one after the other, so the last one finds no other document using the file and deletes it, with its sizes. A filename with `&` or `+` no longer breaks the check.
