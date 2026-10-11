---
'rimecms': patch
---

Fixed: `rime init -f` in a scoped package names the database after the package name made a slug (`@acme/site` → `acmesite`); `--name` refuses a value that is not a slug.
