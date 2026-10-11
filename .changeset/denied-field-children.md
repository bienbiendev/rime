---
'rimecms': patch
---

Fixed: a field the caller may not write is dropped with every field inside it, before it is validated. A group the caller may not write keeps its blocks, tree items and relations, its required members are not reported missing, a unique field the caller may not write is not looked up, and inside a block or a tree item the save sends, such a field keeps its stored value, the relations and nested rows it holds included, wherever the row moves. A new version keeps it the same way.
