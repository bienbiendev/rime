---
'rimecms': patch
---

Fixed: a `.js` file under the config folder is split like a `.ts` file. Its `$` members, such as `$url` or `$hooks`, and the constants only they read, stay on the server instead of reaching the panel's public JavaScript.
