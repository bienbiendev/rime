---
'rimecms': minor
---

Changed: the generated schema indexes `owner_id` on every child table (blocks, tree, locales,
versions, relations), each relation target column, `updated_at`, the `url` column of a config
with `$url`, and `_parent` on a nested collection. A list of 20 documents over 300 pages drops from about 17 ms of SQL to about 1 ms.
The next `rime generate` writes the migration that creates them.
