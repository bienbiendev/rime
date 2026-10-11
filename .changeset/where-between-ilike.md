---
'rimecms': patch
---

Fixed: the `between` and `not_between` filters take their two bounds, as `1,10` in a URL or `[1, 10]` in code, and `ilike` runs on SQLite. `between` matched nothing and `ilike` answered 500; a range that is not two values is refused.
