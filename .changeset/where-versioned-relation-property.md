---
'rimecms': patch
---

Fixed: a filter on a field of a related versioned document, such as `?where[category.title][equals]=News` with versioned `categories`, finds the documents whose related document has a version holding the value, a draft included. It found none.
