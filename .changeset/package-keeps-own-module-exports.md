---
'rimecms': patch
---

Fixed: `rime package` and `rime generate-exports` keep the `/module` entries of package.json `exports` that the author wrote, such as `"./widgets/module": "./src/widgets/module.js"` or an alias to another folder's pair. They delete only the entries a previous run wrote, where they deleted every key ending in `/module`.
