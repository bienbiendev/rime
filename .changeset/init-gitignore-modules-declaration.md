---
'rimecms': patch
---

Fixed: `rime init` adds `src/rime.modules.generated.d.ts`, the declaration file the Vite plugin writes for `$rime/modules`, to .gitignore, next to `src/rime.generated.d.ts`.
