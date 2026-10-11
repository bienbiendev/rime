---
'rimecms': patch
---

Fixed: the adapter's `updateWhere` reads a filter on a localized field in the locale it writes, and refuses a filter that keeps every row, such as an empty `and`. The localized filter matched nothing, and the empty filter updated every row.
