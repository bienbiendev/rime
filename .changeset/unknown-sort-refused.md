---
'rimecms': patch
---

Changed: a list sorted on a field that is not a column is refused, like a filter with an unknown operator. `?sort=titel` used to answer the list ordered by creation date, hiding the typo.
