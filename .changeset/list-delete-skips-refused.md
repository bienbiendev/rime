---
'rimecms': patch
---

Fixed: a list delete that matches a row the caller may not delete, such as a super admin, leaves that row, deletes the others, and answers the ids it deleted, instead of failing halfway through. The panel's bulk delete counts the documents the answer lists, and says how many were not deleted.
