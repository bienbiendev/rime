---
'rimecms': minor
---

Added: `block(...).render(Component)` draws the block on the stage of focus mode. The component gets `block`, `path`, `fields` and `form`, so it can show the value, resolve its relations with `populate` from `rimecms/panel`, and mount panel fields with `RenderFields`; a `children` snippet draws the block's nested lists where the render puts it. With a render in the list, the stage becomes the stack of renders, click to select, and the fields move to an inspector on the right; with nothing selected the inspector lists the types to add, and a type drags from it onto the stage or into the layers. Relation lookups of the live store are cached for the page's life.
