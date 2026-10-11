---
'rimecms': patch
---

Fixed: an access rule written as `undefined`, such as `access: { read: flag ? anyone : undefined }`, keeps the staff-only default instead of answering 500 on every request it guards.
