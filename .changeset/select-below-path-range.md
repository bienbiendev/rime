---
'rimecms': patch
---

Fixed: selecting a blocks or tree field whose name holds `_` reads only its own relations. `?select=my_list` also loaded the relations of a sibling field such as `myXlist`.
