---
'rimecms': patch
---

Fixed: every error code has a text in English and French. A weak password, a taken unique value or an invalid slug read as a sentence under the field instead of `errors.password_min_8`, and failure toasts read "An error occurred" instead of `error.generic`.
