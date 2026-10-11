---
'rimecms': patch
---

Fixed: config validation checks a slug starting with `$` too: it must be camelCase parts joined by `__`, like the slugs rime derives (`$pages__versions`). Any `$` slug used to skip the slug rules.
