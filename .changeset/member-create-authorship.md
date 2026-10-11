---
'rimecms': patch
---

Fixed: a signed-in member of a non-staff auth collection can create a document where the collection lets them, instead of answering 500 on the `createdBy` foreign key. `createdBy` and `updatedBy` record staff only, and only staff may set them on a create.
