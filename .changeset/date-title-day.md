---
'rimecms': patch
---

Fixed: a document whose title field is a `date('…').isTitle()` is titled with its day, `YYYY-MM-DD`, instead of its id. A title field that holds an empty string or an empty rich text now titles the document with its id instead of `''`.
