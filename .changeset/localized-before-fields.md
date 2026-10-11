---
'rimecms': patch
---

Fixed: `localized()` called before `fields()` on a group or a tree localizes the fields given after it. A group threw, and a tree left its fields unlocalized.
