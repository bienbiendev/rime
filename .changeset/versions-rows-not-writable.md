---
'rimecms': patch
---

Fixed: a version row cannot be created or updated through `/api/<collection>--versions` any more, which let a `PATCH` publish a draft beside the published version. A version is made and changed through its document. Reading and deleting version rows is for staff the document allows: a caller who is not staff now gets 403 on a delete, even when the document's `delete` rule allows them.
