---
'rimecms': patch
---

Fixed: an update of an auth document that sends `authUserId` is refused with 403, as `email`, `name` and `password` are. A member could relink their document to another better-auth user, and a delete then removed that user.
