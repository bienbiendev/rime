---
'rimecms': patch
---

Fixed: a block or tree item reads with every field of its own, empty when nothing is stored, as the document does: a hero block with no image reads `image: []` instead of having no `image` key. A row's bookkeeping (`path`, `position`) is still left out of a read outside the panel.
