---
'rimecms': patch
---

Fixed: the site's own origin is always trusted, read without a path or trailing slash, and `$trustedOrigins` adds to it. An authored `$trustedOrigins`, or a `SITE_URL` ending in `/`, made the panel's deletes, status changes, slug changes and uploads answer 403.
