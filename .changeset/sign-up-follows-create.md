---
'rimecms': patch
---

Fixed: a public sign-up follows the auth collection's own `create` rule, and only goes to an auth collection of `password` type. It created its document as rime, in any collection its `type` named.
