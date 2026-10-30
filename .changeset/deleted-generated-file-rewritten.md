---
'rimecms': patch
---

Fixed: a generated file deleted by hand, `src/app.generated.d.ts`, `src/rime.generated.d.ts` or the `src/routes/(rime)` folder, is written again at the next `vite dev` start, even when the config did not change. Without the routes folder the panel answered 404 until the config changed.
