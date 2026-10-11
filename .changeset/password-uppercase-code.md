---
'rimecms': patch
---

Fixed: the error code for a password without an uppercase letter is spelled `password_uppercase_missing`. It was `password_uppercase_mmissing`; an API client that matched the misspelled code needs the new one.
