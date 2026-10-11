---
'rimecms': patch
---

Fixed: a relation row whose locale changes, when its field becomes localized or stops being localized, is written with its new locale, instead of being updated again on every save.
