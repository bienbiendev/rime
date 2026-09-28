---
'rimecms': minor
---

Added: `block(...).render(Component)` draws the block on the stage of focus mode. The component gets `block`, `path`, `fields` and `form`, so it can show the value, resolve its relations with `populate` from `rimecms/panel`, and mount panel fields with `RenderFields`; a `children` snippet draws the block's nested lists where the render puts it. With a render in the list, the stage becomes the stack of renders, click to select, and one panel on the right has three tabs, the layers, the selected block's fields and the types to add, the tab it opens on when the list is empty: a click on a render turns it to the fields, and with nothing left selected it turns to the types. A type drags from it onto the stage. The selected block has a bar above it, duplicate and delete, and arrows beside it to move it up or down; its layer row lifts, with a pencil that opens its fields. Relation lookups of the live store are cached for the page's life.
