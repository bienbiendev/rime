---
'rimecms': patch
---

Fixed: a new version of a localized area copies the other locales as a locale copy, as a collection does: their field hooks, validation and required checks do not run again on values already checked where they came from.
