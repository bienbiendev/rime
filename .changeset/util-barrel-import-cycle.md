---
'rimecms': patch
---

Fixed: `createBlankDocument is not defined` at boot. The `util` barrel re-exported `doc.ts`, and
library code that reached for `validate`, `access` and `random` through the barrel closed a cycle
back into it, so the barrel's namespace spread ran while `doc.ts` was still evaluating. Those
modules now import what they use directly, and the barrel is a leaf of the import graph.
