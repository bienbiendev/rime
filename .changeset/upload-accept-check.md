---
'rimecms': patch
---

Fixed: an upload collection with `accept` refuses a file of another type when it is picked or dropped, with a toast and a field error, instead of at save. The file chooser offers the accepted types only.
