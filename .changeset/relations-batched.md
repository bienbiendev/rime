---
'rimecms': patch
---

Changed: with `depth`, the documents a list's relations point at are read in one query per
collection and level, instead of one `findById` per relation. A list of 20 pages at depth 1 goes
from 40 reads to 1.
