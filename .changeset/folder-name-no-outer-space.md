---
'rimecms': patch
---

Fixed: an upload folder name can no longer start or end with a space, so `root: foo ` is refused with 400 instead of making a second folder shown as "foo". Spaces inside a name, as in `my docs`, are still allowed.
