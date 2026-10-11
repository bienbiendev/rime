---
'rimecms': patch
---

Fixed: `?skipValidation=true` only lets a staff request leave required fields empty. Field hooks, sanitizers, `validate`, unique and the relation check always run, so a caller can no longer store a `javascript:` link or raw HTML by adding the parameter. A required field left empty takes its default. Without one it is not written, instead of being written `''`: a create leaves the column to its own default, and an update keeps the column's stored value.
