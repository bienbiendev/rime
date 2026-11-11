---
'rimecms': minor
---

Added: `validate.string` in `rimecms/util` takes a string and refuses anything else with `not_a_string`, as the text field does: `validate.string(4)` answers `'not_a_string'`.
