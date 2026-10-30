---
'rimecms': patch
---

Fixed: `/api/auth/*` gets the same CORS as the rest of the API. A trusted origin's preflight answers 204 with the CORS headers, where it answered 404, and an untrusted `Origin` is refused with 403 on every method.
