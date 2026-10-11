---
'rimecms': patch
---

Fixed: a new block or tree item sent without some of its fields gets each one's default, `null` without one, so a required field it leaves out is refused instead of being saved empty. A stored row sent in part keeps its stored values.
