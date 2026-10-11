---
'rimecms': patch
---

Fixed: a panel link to another collection, area or collection document shows that page on the first click. The page load now reads the slug from its own event, so SvelteKit runs it again when the slug changes instead of keeping the previous page's data.
