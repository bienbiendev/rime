---
'rimecms': patch
---

Fixed: in dev, a config edit is picked up when `RIME_CONFIG_DIR` starts with `./`, and on Windows. It was ignored until the dev server restarted.
