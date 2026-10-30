---
'rimecms': patch
---

Fixed: when moving an upload folder fails on one of its sub-folders, the error names that sub-folder and keeps its cause, such as `Error when moving child directory root:a:x: form_error — label: Required`, where it read only "Error when updating child directories".
