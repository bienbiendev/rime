---
'rimecms': patch
---

Fixed: on a declared table handle (`rime.adapter.table(…)`), a `null` value in `where` finds the rows that hold none, and a `select` naming a column the table does not have is refused with the column's name. The `null` filter matched nothing, and the unknown column threw a `TypeError`.
