---
'rimecms': patch
---

Fixed: a system update of the super-admin (`rime.collection('staff').system().updateById(…)`) goes through, whoever made the request. It was refused unless the request's own user was the super-admin.
