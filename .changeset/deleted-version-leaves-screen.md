---
'rimecms': patch
---

Fixed: deleting the version on screen, or discarding your own auto-save, from a document opened at its plain panel address no longer leaves the form on the deleted row: the page lands on the newest stored row, the form shows it, and the next save writes it. Discarding the row on screen from the history also closes the history, as picking a version does.
