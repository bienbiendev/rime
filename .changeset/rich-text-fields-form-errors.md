---
'rimecms': patch
---

Fixed: in the form of a rich-text `fields()` node, a field keeps its error until its own value is valid, where a change in another field cleared it. The node takes the form's values only while every field is valid, and keeps its last valid values meanwhile.
