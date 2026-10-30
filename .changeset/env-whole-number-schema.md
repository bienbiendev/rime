---
'rimecms': patch
---

Fixed: the src/env.ts that `rime init` writes refuses a `SMTP_PORT` or `RIME_LOG_TO_FILE_MAX_DAYS` that is not all digits: `SMTP_PORT=46S` or an empty `SMTP_PORT=` stops the app at startup and names the variable, where it ran with `NaN` or 0. An existing src/env.ts keeps its own schemas; to get the check, replace its two `Number(value ?? …)` schemas with the ones `rime init` now writes.
