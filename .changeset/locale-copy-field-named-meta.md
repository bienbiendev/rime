---
'rimecms': patch
---

Fixed: copying locales to a new version or a duplicate keeps a localized field named like a row meta, such as `ownerId` or `createdAt` inside a group. Such a field was never copied to the other locales.
