---
'rimecms': patch
---

Fixed: a `versionId` filter on a versioned list answers the document that holds that version. It answered nothing, because the filter was rewritten in place and read a second time.
