---
'rimecms': patch
---

Fixed: a translation keeps a brace with no `|` as written. Only `{a|b}` is a list of variants; `Use {name} here` read as `Use name here`.
