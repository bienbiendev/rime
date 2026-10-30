---
'rimecms': patch
---

Fixed: the text, textarea, number and time fields refuse a value with an error code instead of an English sentence, so the panel shows the message in its own language. A form error from the API names the code: `not_a_string`, `not_a_number`, `number_too_small`, `number_too_large` or `invalid_time`.
