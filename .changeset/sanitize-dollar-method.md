---
'rimecms': patch
---

Fixed: a `$` member written as a method, `$url(doc) { … }`, or with a quoted key, `'$url': …`, is removed from the panel's copy of the config, with what only it reads. It used to ship to the browser, and a `.server` import it read failed the panel build.
