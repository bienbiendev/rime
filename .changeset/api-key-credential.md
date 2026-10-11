---
'rimecms': patch
---

Fixed: an api key sent in `x-api-key` is a credential on its own. The request runs as the key's document with the key's roles, with no session needed, and a session sent with it is ignored. A key that does not verify, or one carrying `admin` that was made by someone who is not a better-auth admin, answers 401. Only an admin can give a key `admin` afterwards, and a key never opens the panel. Keys no longer stop at ten requests a day, existing keys included. A key used to be ignored without a session, with one it only replaced the session user's roles, and its eleventh request in a day answered 401.
