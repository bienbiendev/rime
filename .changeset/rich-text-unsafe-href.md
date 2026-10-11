---
'rimecms': patch
---

Fixed: a rich-text link whose `href` runs script (`javascript:`, `vbscript:`, `data:`) loses its `href` when it is saved, and `RenderRichText` leaves out such an `href` stored before this fix.
