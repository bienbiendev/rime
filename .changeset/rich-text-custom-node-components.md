---
'rimecms': patch
---

Fixed: in `RenderRichText`, a component for a custom node type gets the `components` prop, as a component for a custom mark does. It was `undefined`.
