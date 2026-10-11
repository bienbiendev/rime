---
'rimecms': patch
---

Fixed: a radio given a second `options(...)`, on a clone for instance, starts on one of its new options. It kept the first option of the old list, and a new document's save answered 400.
