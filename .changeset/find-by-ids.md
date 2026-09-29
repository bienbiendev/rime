---
'rimecms': minor
---

Added: `rime.collection(slug).findByIds({ ids })` reads several documents in one query. Each id is
checked against the read access as `findById` checks it; a missing or refused one is left out.
