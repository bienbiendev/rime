---
'rimecms': patch
---

Fixed: the text, textarea, number, time, checkbox, toggle, select, radio and combobox fields refuse a value with an error code instead of an English sentence, so the panel shows the message in its own language. A form error from the API names the code: `not_a_string`, `not_a_number`, `number_too_small`, `number_too_large`, `invalid_time`, `not_a_boolean`, or `not_an_option` for a value that is not one of the options or an option picked twice.
