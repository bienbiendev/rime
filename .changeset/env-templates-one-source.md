---
'rimecms': patch
---

Changed: `rime init`, `rime build -e` and `rime env` write the `.env` from one list. `rime init` on an existing `.env` adds the missing variables with their comments, `RIME_CACHE_ENABLED` included. The production `.env` writes `RIME_LOG_TO_FILE_MAX_DAYS=30`, `HOST=127.0.0.1` (the address `index.js` falls back to) and the same SMTP placeholders as development.
