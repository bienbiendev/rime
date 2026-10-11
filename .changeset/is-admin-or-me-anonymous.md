---
'rimecms': patch
---

Fixed: `access.isAdminOrMe` refuses an anonymous caller when no id is given. A list operation called it with no id, so an anonymous visitor passed a rule built on it, such as `read: (user, { id }) => access.isAdminOrMe(user, id)`.
