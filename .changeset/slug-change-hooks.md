---
'rimecms': patch
---

Fixed: changing a page's slug runs the collection's `beforeOperation` hooks, its access rule included, and its `afterUpdate` hooks on the page with its new url, so a guard, a cache purge or a webhook placed there sees a slug change as it sees a save.
