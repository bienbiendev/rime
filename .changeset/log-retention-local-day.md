---
'rimecms': patch
---

Fixed: the log cleanup counts a file's age in local days. West of UTC, with `RIME_LOG_TO_FILE_MAX_DAYS=1`, today's log was deleted in the evening with every line written before.
