---
'rimecms': patch
---

Fixed: a `panel.routes` key that names a collection, an area or a fixed panel page (`sign-in`, `live-edit`, …) is refused, with an error that names the key. A key `pages` beside a `pages` collection hid the collection's list, and a key `live-edit` stopped the panel from starting.
