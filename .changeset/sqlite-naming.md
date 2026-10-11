---
'rimecms': patch
---

Fixed: in the SQLite adapter, a relation to a collection whose slug holds `Id` (`productIdeas`) reads back with the right `relationTo`, and a query on a property of a relation to a camelCase slug no longer fails. A field named `paid`, `valid` or `grid` no longer removes its table's primary key.
