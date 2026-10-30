---
'rimecms': patch
---

Fixed: a create on a collection without versions drops the `id` its data names, unless the collection declares an `id` field, as upload directories do. `POST /api/pages { "id": "count", … }` made a page whose id is `count`, and an `id` already taken answered 500. This holds for the local API too: a seed that names its documents' ids, on a collection with no `id` field, now gets new ids.
