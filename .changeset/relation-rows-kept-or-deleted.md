---
'rimecms': patch
---

Fixed: saving relations deletes the right rows. A row was kept when the same document arrived at another block index or a field whose name read like its path, and a relation sent as a bare id could take the row another relation named by `id`, losing one of the two.
