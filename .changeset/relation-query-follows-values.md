---
'rimecms': patch
---

Fixed: a relation whose `query()` is a function of the document lists the candidates for the values on screen. Its choices follow a change of the fields the query reads, where they kept the ones of the page load.
