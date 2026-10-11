---
'rimecms': patch
---

Fixed: when an area is created for the first time, a required field that its initial document leaves empty takes its column's own default, and a NOT NULL column with no default gets an empty value of its type. A text or boolean column got an empty value over its default, and a number, date or JSON column with no default was left unfilled.
