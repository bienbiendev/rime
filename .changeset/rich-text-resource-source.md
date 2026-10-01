---
'rimecms': patch
---

Fixed: a rich text with several `resource()` features inserts the one picked in the menu; each inserted the last one declared, so `resource({ source: 'pages' })` listed medias when `resource({ source: 'medias' })` came after it.
