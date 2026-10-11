---
'rimecms': patch
---

Fixed: a create or update the caller may write but not read answers `{ doc: { id } }` instead of 403 after the row is written, and leaves out the fields they may not read. The afterCreate and afterUpdate hooks get the whole document.
