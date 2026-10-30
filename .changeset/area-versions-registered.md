---
'rimecms': patch
---

Fixed: a versioned area's versions collection is typed: `rime.collection('$settings__versions')` type-checks and returns the area's doc type, as `$news__versions` already did for a versioned collection.
