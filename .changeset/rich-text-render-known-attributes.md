---
'rimecms': patch
---

Fixed: `RenderRichText` no longer spreads every stored attribute of a node or mark on its default elements, so a `style` or `class` saved through the API does not reach the site. A link writes its `href`, `target` and `rel`, an ordered list its `start`, and the other elements no attribute. A site that needs more passes its own component in `components`.
