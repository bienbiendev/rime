---
'rimecms': patch
---

Fixed: a `rime generate` run that died no longer stops dev codegen once its process id is reused. Its marker counts as stale after ten minutes, and when dev codegen does step aside for a run, it says so in a warning.
