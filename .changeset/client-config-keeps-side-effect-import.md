---
'rimecms': patch
---

Fixed: a side-effect import in a config file, `import './register.js'`, stays in the panel copy of that file, so it runs in the panel too.
