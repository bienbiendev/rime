---
'rimecms': patch
---

Fixed: on a versioned list, an `offset` that is not a number is ignored, as it already was on other lists. `?offset=abc` answered 500.
