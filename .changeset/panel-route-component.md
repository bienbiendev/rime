---
'rimecms': patch
---

Fixed: a custom panel page whose `component` is an imported Svelte component (`panel.routes: { stats: { label, component: Stats } }`) renders it. The page read "Cannot parse provided component path".
