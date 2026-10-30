---
'rimecms': patch
---

Fixed: a config that imports `rime` under another name, `import { rime as r } from '$rime/config'`, loads in the panel instead of failing on `r is not defined`.
