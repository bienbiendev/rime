---
'rimecms': patch
---

Fixed: the checkbox, toggle, select, radio and combobox fields refuse a value with an error code instead of an English sentence, so its message reads in the panel language. A form error from the API names the code: `not_a_boolean`, or `not_an_option` for a value that is not one of the options or an option picked twice.
