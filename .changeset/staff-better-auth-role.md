---
'rimecms': patch
---

Fixed: a staff member who is not an admin can create a user in a collection that allows it, and can no longer list or delete accounts through `/api/auth/admin/*`, which skipped rime's access rules. The `roles` field of a collection other than staff can only be changed by staff.
