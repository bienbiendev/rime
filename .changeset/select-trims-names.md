---
'rimecms': patch
---

Fixed: `?select=title, attributes.slug` reads the names with the spaces around each comma trimmed, so a name after a space selects its field.
