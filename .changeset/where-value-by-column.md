---
'rimecms': patch
---

Fixed: a filter value is read as the type of the column it is compared to. A text field keeps the value as sent, so `007`, `1e3`, an empty value or a date-like text are found, and a localized field matches a number-like value. A number, boolean or date column still reads the string as its type, a date column refuses a value that is not a date, and `in_array` takes a single value from code.
