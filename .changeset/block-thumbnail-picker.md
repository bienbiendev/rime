---
'rimecms': minor
---

Added: `block(name).thumbnail(Component)` draws a block in the pickers of types to add. The component renders an `<svg>`, which fills a 16:10 frame and draws with `currentColor`, so it follows the light and dark themes; a block without one shows its icon. The pickers are one set of tiles: _Add a block_ in the document and `/` in the blocks editor open them in a dialog, three a row, with a search and the arrows to move; the editor's _Blocks_ tab shows them two a row, to click or drag.
