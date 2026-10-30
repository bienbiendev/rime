---
'rimecms': patch
---

Fixed: `rime build -s` packs ./app with a warning when the project has no `static/` folder, as `-w` already did with no `storage/`, where it threw `ENOENT` halfway and left ./app without its index.js. When the SvelteKit adapter writes somewhere other than ./build, `rime build` stops with an error before it writes ./app.
