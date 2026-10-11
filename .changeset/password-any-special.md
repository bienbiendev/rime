---
'rimecms': patch
---

Fixed: a password counts any character that is not a letter or a digit as its special character, so `/`, `,`, `[`, `~` or a space no longer reads as "Needs a special character".
