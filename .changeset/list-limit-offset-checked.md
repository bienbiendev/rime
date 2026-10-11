---
'rimecms': patch
---

Fixed: `?limit=` and `?offset=` on a list GET or DELETE answer 400 unless they are whole numbers, from 1 for `limit` and from 0 for `offset`, instead of reading `?limit=abc` as no limit, which on a DELETE removed every match.
