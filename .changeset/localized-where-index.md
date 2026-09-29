---
'rimecms': patch
---

Changed: `equals` and `in_array` on a localized field first narrow to the documents with a locale
row holding the value, so an indexed column such as `url` is read through its index instead of
checking every document.
