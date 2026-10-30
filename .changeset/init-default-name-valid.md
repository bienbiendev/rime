---
'rimecms': patch
---

Fixed: `rime init` falls back to the name `app` when the package name does not make a valid project name, such as `1password-clone`. With `--force` it named the database with a name `--name` refuses, and without it the question offered that name as its default and asked again on every Enter.
