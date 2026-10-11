---
'rimecms': patch
---

Fixed: the unique check looks up the value as sent. A value with `+`, `&` or `%` (`a+b`) was read as another value (`a b`), passed the check, and the save failed on the database's unique constraint. An empty value is no longer looked up.
