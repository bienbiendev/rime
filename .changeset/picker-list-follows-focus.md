---
'rimecms': patch
---

Fixed: the search of a link, select or relation field opens its list when it is clicked again right after a pick is removed. The list closed 200 ms after any blur, and that late close shut the list opened meanwhile; it now shows while the search has the focus, and a click on a line picks it before the search lets go of the focus.
