---
'rimecms': patch
---

Fixed: the cache plugin adds `cache-control: private, max-age=3600` and `vary: Cookie` to a successful page only, so a browser no longer keeps a redirect or an error for an hour, and a sign-in or a locale change reads the page again.
