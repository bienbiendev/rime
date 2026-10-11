---
'rimecms': patch
---

Fixed: a read with `localeFallback: false` and a `depth` reads the related documents without fallback too, instead of filling their empty fields from the default locale.
