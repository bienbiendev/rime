---
'rimecms': minor
---

Breaking Change: the panel sign-in goes through better-auth's rate limiter, as `/api/auth/sign-in/email` does: outside dev, a fourth attempt within 10 seconds from one address is refused without a password check. The limiter tells clients apart by their address, so run rime behind a proxy that sets `x-forwarded-for`; without it, every sign-in shares one limit. The session now also records the visitor's address and user agent.
