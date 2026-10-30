---
'rimecms': patch
---

Fixed: an `ondragstart` passed to `NodeViewWrapper` runs when the node is dragged, and the node still drags. It was replaced by the wrapper's own handler.
