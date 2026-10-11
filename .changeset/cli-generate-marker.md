---
'rimecms': patch
---

Fixed: an interrupted `rime generate` no longer stops code generation in later dev starts. Its marker names its process, and a marker left by a process that died blocks nothing.
