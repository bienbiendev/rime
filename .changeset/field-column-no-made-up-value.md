---
'rimecms': patch
---

Fixed: a translated field reads the fallback locale's value until its own locale writes it, instead of `0`, `false` or an empty rich text `{}`. A field column no longer has `NOT NULL` or a `DEFAULT`, `is_auto_save` aside: `NULL` means nothing was written, a field's `defaultValue` is filled on save, and `required` is checked by validation. Run drizzle-kit generate, then migrate: every table with a required field column is rebuilt once, and keeps its rows. A locales row written before keeps the value it holds until that locale writes the field.
