---
'rimecms': patch
---

Fixed: a better-auth sign-up checks rime's password policy before the account is written, so `aaaaaaaa` is refused with 400 and no account or document is created.
