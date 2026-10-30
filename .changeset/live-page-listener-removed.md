---
'rimecms': patch
---

Fixed: the live edit page stops listening to its preview once it is left. A second visit no longer runs the first visit's listener, which still navigated and opened panels for a page that was gone.
