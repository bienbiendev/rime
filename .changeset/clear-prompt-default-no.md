---
'rimecms': patch
---

Fixed: `rime clear` asks once, ending with `(y/N)`, which matches its default: an empty answer cancels. It printed "(Y/n)" twice, as if Enter meant yes.
