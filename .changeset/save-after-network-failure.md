---
'rimecms': patch
---

Fixed: after a save or an auto-save that got no answer (a dropped connection), the document can be saved again without reloading the page. The failure shows as an error toast.
