---
'rimecms': patch
---

Fixed: an upload collection's root folder is created by rime on the first visit of its list page, whoever visits, so a user who may read the collection but not create in it sees the list instead of an error page, and two first visits at once both see it instead of one answering 500.
