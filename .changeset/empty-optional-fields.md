---
'rimecms': patch
---

Fixed: an optional email, slug, number or time field can be emptied, in the panel and through the API. The empty value failed the field's format check; a number sent as `''` is stored as no number.
