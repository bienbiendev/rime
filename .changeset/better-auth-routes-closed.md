---
'rimecms': patch
---

Fixed: better-auth's own user and admin routes under `/api/auth` (`delete-user`, `update-user`, `change-email`, `admin/*`) answer 404. An admin can no longer reset the super-admin's password or delete it through them, and a signed-in user can no longer delete their own document or move their session to another collection past rime's access and hooks.
