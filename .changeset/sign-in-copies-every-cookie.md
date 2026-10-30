---
'rimecms': patch
---

Fixed: the panel sign-in sets every cookie better-auth sets, the session's and any plugin's, with the lifetime and attributes better-auth gives it, where it kept the first cookie only with a fixed 7-day lifetime. A sign-in that opens no session, like a two-factor step, now answers the form with an error instead of looping back to the sign-in page.
