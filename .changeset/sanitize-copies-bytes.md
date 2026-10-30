---
'rimecms': patch
---

Fixed: an image, a font or any other binary file in the config folder is copied to the generated folder byte for byte. It was read as text and came out corrupt.
