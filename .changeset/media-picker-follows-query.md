---
'rimecms': patch
---

Fixed: the media library picker of an upload relation lists only the files its `query()` names, in a folder, a search and a type filter alike. `relation('image').to('medias').query('where[mimeType][like]=image%')` no longer offers a PDF.
