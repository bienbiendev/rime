---
'rimecms': patch
---

Fixed: the heading of the panel error page, src/routes/(rime)/+error.svelte, is semi-bold (`font-weight: 600`); it asked for `semibold`, which is not a CSS value, and rendered at the normal weight.
