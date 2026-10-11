---
'rimecms': patch
---

Fixed: every API answer carries `Vary: Origin`, a preflight included, whether or not the request sent an `Origin`. A shared cache could hand one origin's answer to another, whose browser refused it.
