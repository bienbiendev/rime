---
'rimecms': patch
---

Fixed: the panel sign-in goes through better-auth's rate limiter, as `/api/auth/sign-in/email` does: outside dev, a fourth attempt within 10 seconds from one address is refused without a password check. The limiter tells clients apart by their address, so run rime behind a proxy that sets `x-forwarded-for`, or set `advanced.ipAddress` in the auth config; without one, every sign-in shares one limit. The session now also records the visitor's address and user agent.
