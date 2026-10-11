---
'rimecms': patch
---

Fixed: a read resolves 3 levels of relations at most, whatever `depth` it asks for. The cap holds for the REST API and the local API alike: `?depth=50` and `rime.collection('pages').find({ depth: 50 })` both read at 3. A negative `?depth=` reads as 0.
