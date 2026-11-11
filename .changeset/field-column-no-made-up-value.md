---
'rimecms': minor
---

Breaking Change: a field column no longer has `NOT NULL` or a `DEFAULT`, `is_auto_save` aside: `NULL` means nothing was written, a field's `defaultValue` is filled on save, and `required` is checked by validation. This undoes the 1.2.0 defaults: a required column no longer gets a default of its type, and an area's first document no longer writes an empty value into a `NOT NULL` column. A translated field now reads the fallback locale's value until its own locale writes it, instead of `0`, `false` or an empty rich text `{}`. Run `rime generate`, then migrate: every table with a required field column is rebuilt once, and keeps its rows. A locales row written before keeps the value it holds until that locale writes the field. A column that must stay `NOT NULL` says so with `$notNull({ default })`.
