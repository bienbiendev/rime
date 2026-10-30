---
'rimecms': patch
---

Fixed: the panel's user menu, Profile and the page after Sign out, stays on the host the panel is opened on instead of going to `SITE_URL`, where the session cookie may not be set.
