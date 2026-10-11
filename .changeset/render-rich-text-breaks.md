---
'rimecms': patch
---

Fixed: `RenderRichText` renders a line break as `<br>` and a horizontal rule as `<hr>`, and keeps the text of a mark it has no component for, without the mark. All three were left out of the page.
