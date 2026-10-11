---
'rimecms': minor
---

Added: the `$beforeDuplicate` field hook gives a field its value on a copy of its document, after the field type's own copy: `email('contact').unique().$beforeDuplicate(() => null)` leaves the copy without one.
