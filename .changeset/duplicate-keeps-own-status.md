---
'rimecms': patch
---

Fixed: a duplicate keeps a `status` field the author declared on a collection without drafts, such as a ticket's `closed`, instead of resetting it to its default. On a collection with drafts, the copy still starts as a draft.
