---
'rimecms': patch
---

Fixed: a relation fetched from a site page or a panel preview requests the API path, whatever the page's own path; it requested `api/…` relative to the page, a 404 under `/panel/pages/<id>` or `/fr/…`.
