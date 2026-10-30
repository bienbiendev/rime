---
'rimecms': patch
---

Fixed: a move in a nested collection's tree reloads the list once it is saved or refused. A cleared search no longer redraws the tree as it was before the move, and a refused move with an expired session no longer breaks the list page.
