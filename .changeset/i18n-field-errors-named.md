---
'rimecms': patch
---

Fixed: a field error says what is wrong ("Required") instead of "Field  is required" with the name missing. A `RimeFormError` message names each field before its text: `title: Required, slug: Only lowercase letters, digits and dashes`.
