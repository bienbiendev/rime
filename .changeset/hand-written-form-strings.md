---
'rimecms': patch
---

Fixed: a hand-written form keeps its values as the strings it sends, so a postcode, a phone number or a title such as `2024` is stored as typed instead of becoming a number, and a key sent several times, such as a `<select multiple>`, arrives as a list instead of its last value. A number field reads its string as a number, and a checkbox or a toggle reads `'true'`, `'on'` and `'false'` as booleans. `'null'` and `'[]'` still empty a field, and `'undefined'` is now kept as a string.
