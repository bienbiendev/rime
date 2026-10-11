---
'rimecms': patch
---

Fixed: in development, changing `RIME_PANEL_ROUTE` regenerates the routes at the next start. Every panel URL answered 404 until the config changed too.
