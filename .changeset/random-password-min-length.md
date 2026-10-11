---
'rimecms': patch
---

Fixed: `random.randomPassword` throws a `RangeError` for a length under 4, the one character of each kind it holds. It returned 4 characters, most of them fixed.
