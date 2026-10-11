---
'rimecms': patch
---

Fixed: a `RIME_LOG_TO_FILE_MAX_DAYS` of `0`, empty or not a number keeps log files for thirty days. `0` or empty deleted today's file every hour, and a value that is not a number kept every file forever.
