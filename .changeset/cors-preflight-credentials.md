---
'rimecms': patch
---

Fixed: a CORS preflight from a trusted origin allows credentials, so a credentialed `PATCH` or JSON request from another origin goes through.
