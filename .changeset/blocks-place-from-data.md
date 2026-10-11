---
'rimecms': patch
---

Fixed: a block takes its place from where it sits in the data. A block read from the API and sent back in another order kept the `position` it was read with, and its relations ended up on another block.
