---
'rimecms': patch
---

Fixed: a `HEAD` request on a REST route or on a route declared in `$routes` is answered by its `GET` handler. It answered 404.
