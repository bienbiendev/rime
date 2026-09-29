---
'rimecms': patch
---

Fixed: deleting a page whose child has a slug a top page holds, or moving a page under a parent where a sibling holds its slug, answered 500. The moved page takes the next free slug: `team-2`.
