---
'rimecms': patch
---

Fixed: the panel's upload header shows a picked file by the type the server stores it as, read from its extension, so a file the browser cannot type, such as `scan` or a `.heic`, shows as picked (`application/octet-stream`) instead of leaving the drop zone empty. The header and the bulk upload refuse a file the server would refuse, such as `.html` in a collection without `accept`, at once and with the server's own message, and take one it would take, whatever type the browser gives it.
