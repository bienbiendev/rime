---
'rimecms': patch
---

Fixed: a field's `.validate()` adds a rule after the field's own check instead of replacing it, so `number('age').min(0).validate(...)` still refuses `-5`, and an email, a checkbox or a select with a rule still refuses a value of the wrong kind.
