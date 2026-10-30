---
'rimecms': patch
---

Fixed: a single select takes one option as its default, `select('status').options('draft', 'live').defaultValue('draft')`, which TypeScript refused; a list stays the default of a `.many()` select.
