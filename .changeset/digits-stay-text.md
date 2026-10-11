---
'rimecms': patch
---

Fixed: a text made only of digits (`"2024"`, `"007"`) is saved as text, from the panel and from a JSON body. It was turned into a number, losing leading zeros, and refused by the text field.
