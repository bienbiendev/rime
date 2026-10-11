---
'rimecms': patch
---

Fixed: with the cache on, a route that sets its own `cache-control` keeps it, and a `load` calling `setHeaders({ 'cache-control': … })` no longer answers 500. `max-age=3600` goes on a response that has none.
