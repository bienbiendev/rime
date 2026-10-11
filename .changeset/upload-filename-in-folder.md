---
'rimecms': patch
---

Fixed: an upload's stored file name never reaches a file outside `static/medias`. A request cannot write `filename` or an image size column, which the saved file sets; a stored name with a folder, `.` or `..` in it is refused, so a delete removes nothing outside the folder and a new version copies no file from outside it.
