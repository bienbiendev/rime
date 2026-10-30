---
'rimecms': patch
---

Fixed: a failing `rime init`, `rime build` or `rime clear` prints its error on one line, such as `Can't find vite configuration file`, and exits with code 1, where Node printed an unhandled rejection with the raw stack.
