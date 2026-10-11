---
'rimecms': patch
---

Fixed: a malformed query, body or uploaded file answers 400 instead of 500, and is no longer logged as a server error with its stack. An upload refused for its content keeps its reason, such as `File type not supported`, in place of `Unable to process file`.
