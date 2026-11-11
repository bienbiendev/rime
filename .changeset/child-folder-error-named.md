---
'rimecms': patch
---

Fixed: when moving an upload folder fails on one of its sub-folders, the error the server logs names that sub-folder and keeps its cause, such as `Error when moving child directory root:a:x: form_error — label: Required`, where it read only "Error when updating child directories". The request answers `operation_error`, as every 5xx does.
