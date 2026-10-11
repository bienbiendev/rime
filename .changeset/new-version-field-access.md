---
'rimecms': patch
---

Fixed: a new version takes the fields the caller may not write from the version it branches from, on `?fork=true`, on every save of a versioned config without drafts, and on an auto-save. The caller's values for those fields, an upload's file name and image sizes among them, were written to the new version.
