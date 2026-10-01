---
'rimecms': patch
---

Fixed: a relation field stays a relation after a dev reload that loads its code twice. The schema generator no longer takes it for a text column, which dropped its junction table and every relation in it.
