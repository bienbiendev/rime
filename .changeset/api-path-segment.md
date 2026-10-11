---
'rimecms': patch
---

Fixed: a site route whose path only starts with `/api` (`/apiary`) is no longer treated as an API route: no API CORS check, and its `slug` param is left alone.
