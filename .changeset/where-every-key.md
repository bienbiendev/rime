---
'rimecms': patch
---

Fixed: a filter with several fields, or several operators on one field, applies all of them. `where[status][equals]=published&where[category][equals]=x` and `{ price: { greater_than: 1, less_than: 10 } }` kept only their first condition.
