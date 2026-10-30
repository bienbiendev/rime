---
'rimecms': patch
---

Fixed: deleting an upload folder deletes its sub-folders and the documents filed in them, each through its own delete, so their files leave `storage/uploads/`. The files stayed on disk, served to anyone for a public collection, and the sub-folders and their documents stayed, hidden from the panel.
