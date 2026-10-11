---
'rimecms': patch
---

Fixed: `rime generate` no longer makes the next `vite dev` rebuild every dependency. Its Vite server keeps its cache in `node_modules/.rime/vite` instead of `node_modules/.vite`.
