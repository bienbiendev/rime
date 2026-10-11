---
'rimecms': patch
---

Fixed: a `where` query string may nest an `or` inside an `and` and list up to 1000 ids, instead of answering 400 or 500, and `?where=foo` is refused as invalid data.
