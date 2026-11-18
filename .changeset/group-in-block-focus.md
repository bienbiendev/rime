---
'rimecms': patch
---

Fixed: selecting a block that holds a group, in focus mode or in the live-edit panel, shows its fields instead of the panel's error page. A field hook's `useField('sections.0.title')` now finds a field inside a block without its type in the path.
