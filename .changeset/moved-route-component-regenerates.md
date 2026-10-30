---
'rimecms': patch
---

Fixed: moving the component of a `panel.routes` entry to another file writes its panel page again, so the page imports the new file. The dev server said "Nothing to generate" and the page kept importing the old path.
