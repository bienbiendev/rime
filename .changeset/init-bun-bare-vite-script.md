---
'rimecms': patch
---

Fixed: `rime init --bun` runs a script written as just `vite`, such as `"dev": "vite"`, with `bun --bun vite`, as it did for `vite build`; it was left to run on Node.
