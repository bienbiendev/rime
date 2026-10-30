---
'rimecms': patch
---

Fixed: `rime init` adds a .gitignore entry such as `/storage` or `.cache` even when a longer line starts with it, like `/storage-backup` or `.cache-loader`, where it took that line for the entry and left storage/ unignored.
