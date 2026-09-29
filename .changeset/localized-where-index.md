---
'rimecms': patch
---

Changed: `equals` and `in_array` on a localized field first narrow to the documents with a locale
row holding the value, so a column indexed with `$index()` is read through its index instead of
checking every document.
