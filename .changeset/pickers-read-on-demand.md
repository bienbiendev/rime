---
'rimecms': patch
---

Fixed: the document pickers no longer read every document of their collection when a form opens. A relation, a link and a rich-text resource, media or link picker read their saved picks by id, and read candidates only while the picker is open: the first 20 whose title holds the typed text, once typing pauses, under a "20 of 143" line. A plain relation asks `GET /api/<collection>/count` to know whether anything is left to pick. Every read goes through the panel's API proxy, so a save refreshes the picks it shows.
