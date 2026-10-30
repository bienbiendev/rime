---
'rimecms': patch
---

Fixed: the rich-text `fields()`, `upload()` and `resource()` nodes show what the node holds after an undo, or after another editor on the same path changes it, and the next edit starts from it instead of writing the old values back. A `fields()` node no longer adds a step to the undo history when the editor opens, and a read-only editor no longer writes its content back to the field.
