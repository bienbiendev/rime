---
'rimecms': patch
---

Fixed: `rimecms/public` imports outside a SvelteKit page, in a component spec. `LiveProvider` loads `$env/dynamic/public` with the first message from the panel, not on import.
