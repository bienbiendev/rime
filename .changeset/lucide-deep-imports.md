---
'rimecms': patch
---

Changed: rime imports each Lucide icon from its own file (`@lucide/svelte/icons/<name>`), so the dev server no longer loads all ~1,900 icons at each start. A config that imports from `@lucide/svelte` itself still loads them all: import from the icon's file instead.
