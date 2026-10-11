---
'rimecms': minor
---

Changed: errors are answered by SvelteKit's `handleError`, which rime exports from `rimecms/server` and adds to `src/hooks.server.ts` when the file has none. A `RimeError` keeps its status, a thrown `error()` keeps its own instead of becoming a 500, and an unexpected error is logged with its stack, its message never sent.
