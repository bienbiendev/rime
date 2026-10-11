---
'rimecms': patch
---

Fixed: a hook that answers without its arguments, such as one that forgets `return args`, fails with an error that names the hook and what it left out, instead of a `TypeError` further down the pipeline.
