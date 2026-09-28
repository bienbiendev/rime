---
'rimecms': major
---

Breaking Change: a block's `.image(url)` is removed, and the preview pane that showed it in the add-a-block menu with it. Give the block a `.thumbnail(Component)` instead: an SVG component, drawn in the pickers of types to add.
