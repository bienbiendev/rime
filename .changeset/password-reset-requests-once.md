---
'rimecms': patch
---

Fixed: the forgot-password and reset-password pages send with Enter, and each password-reset request, a staff document's "Send a password reset link" included, runs once while it is pending, where a double click mailed twice. Their errors show in the panel's language, an invalid or expired reset link says so, and a request that fails on the network shows an error instead of nothing.
