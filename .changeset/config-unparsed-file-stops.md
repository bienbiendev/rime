---
'rimecms': patch
---

Fixed: a config file rime cannot parse stops the config build with `Cannot parse <file>, so its server content cannot be removed: <parser error>`, and the previous generated files stay. It used to be copied as it is to the panel, its `$` content and `.server` imports included, behind a warning.
