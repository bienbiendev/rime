---
'rimecms': patch
---

Fixed: an `id`, `ownerId` or `locale` in a document's data is ignored by the rows a write touches. An update keeps its row's key and owner, a locales row stays on the document and locale it was written for, a saved block stays on its document and locale, and a second locale written with the document's `id` in the body is saved instead of answering 500. An update answers the document it wrote, not the one an `id` in the body names. A folder of an upload collection still moves when its path changes, with its sub-folders and their files.
