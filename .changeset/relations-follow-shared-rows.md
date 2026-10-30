---
'rimecms': patch
---

Fixed: in a blocks or tree field that is not localized, a localized relation follows its block or item in every locale. Removing a block in one locale removes its relations in the others, where they used to show on the block that took its place, and moving a block moves its relations in the others, where they used to stay at the old position.
