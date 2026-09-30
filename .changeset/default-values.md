---
'rimecms': patch
---

Changed: a default value is what a new document starts with, and no longer what an empty value turns back into. A field not sent on a create gets its default; a field sent empty stays empty, and an empty value reads empty instead of its default. `defaultValue(value, { fill: 'save' })` also gives an empty value its default on every save, and `required` no longer fills a field. `blocks()` and `tree()` take a `defaultValue()`, and a block inserted in the panel starts with the default of its nested lists. An area's first boot writes its default blocks, tree items and relations too. A new version keeps a field cleared on purpose. A checkbox counts `false` as a value. `blank()` is renamed `initial()`.
