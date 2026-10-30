---
'rimecms': patch
---

Fixed: an array with a hole, `[1, , 2]`, keeps its hole in the panel copy of a config file that holds server content, instead of becoming `[1, 2]`.
