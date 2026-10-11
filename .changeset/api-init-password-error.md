---
'rimecms': patch
---

Fixed: `POST /api/init` with a weak password answers the password's own error under `password`, instead of `invalid_field` under `name`.
