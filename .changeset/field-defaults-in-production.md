---
'rimecms': patch
---

Fixed: field defaults that only existed on a dev server, inside `tabs()`, now apply everywhere. A text or textarea refuses a value that is not a string, a checkbox or toggle one that is not a boolean, a radio starts on its first option, and a required `select().many()` refuses an empty selection. A number or link field starts empty unless it has a `.defaultValue()`, as it already did in production.
