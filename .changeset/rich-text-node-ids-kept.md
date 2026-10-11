---
'rimecms': patch
---

Fixed: an upload or resource node in rich text keeps the document it points at on a new version and on a duplicate. Only the rows of the document — blocks, tree items, relations — lose their ids to be written anew.
