---
'rimecms': patch
---

Fixed: converting a migrations folder from before drizzle 1.0 no longer counts the converted migrations as new. An old migration that dropped a table made the boot ask about data loss, and a refusal, or a boot without a terminal, deleted the whole migration history.
