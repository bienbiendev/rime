---
'rimecms': patch
---

Fixed: `rime init` writes the starter config in a nested `RIME_CONFIG_DIR` whose parent folder is missing, such as `src/cms/config`, where it failed with `ENOENT` after writing .env, src/env.ts and .gitignore.
