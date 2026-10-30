---
'rimecms': patch
---

Fixed: a create that fails after rime made its better-auth user or api key, in a `beforeCreate` hook or at the insert, removes that user or key again, so the email can be used again. An api key is mailed once its document exists.
