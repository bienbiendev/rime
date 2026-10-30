---
'rimecms': patch
---

Fixed: a day picked in the date field's calendar is stored at 12:00 UTC instead of the editor's local midnight, so a site and every editor from UTC-11 to UTC+11 read the same day. A date stored earlier at a local midnight still reads as before in the time zone it was picked in.
