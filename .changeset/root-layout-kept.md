---
'rimecms': patch
---

Fixed: route generation writes the app's `src/routes/+layout.server.ts` only when the app has no root layout server. It overwrote the app's own on every config change in dev. The written file says that rime's `LiveEdit` reads `user` from it.
