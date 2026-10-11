---
'rimecms': patch
---

Fixed: the keys inside a JSON value are read back as written. A key holding `__`, such as `foo__bar`, came back split as `foo.bar`. A JSON field inside a group whose value held a key with `$` (`{ $x: 1 }`) came back under its column name, `group__data`, rather than `group.data`.
