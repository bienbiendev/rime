---
'rimecms': patch
---

Fixed: a request that sends `authUserId` itself can no longer create an auth document linked to an existing better-auth account. Only better-auth's own sign-up takes that path. An API-key document posted with an `authUserId` gets its key, where it was saved without one.
