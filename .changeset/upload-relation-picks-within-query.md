---
'rimecms': patch
---

Fixed: a file uploaded through an upload relation, from the media library dialog or dropped on the field, is picked only when the field's `query()` names it. A file the query leaves out stays in the library, unpicked: `relation('photos').to('medias').query('where[mimeType][like]=image%')` no longer takes an uploaded PDF.
