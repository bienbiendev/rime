---
'rimecms': patch
---

Fixed: an admin or staff member creating a user without a password gets a form error on `password`. The user was created with no password and could never sign in.
