---
'rimecms': patch
---

Changed: the panel's fonts come from the package, through the panel stylesheet, and `rime init` no longer copies them into `static/`. An existing project may delete `static/assets/panel/fonts`.
