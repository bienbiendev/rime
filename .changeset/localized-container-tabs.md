---
'rimecms': minor
---

Breaking Change: a field inside tabs, in a localized group, blocks or tree, is localized, so each locale keeps its own value instead of sharing one. Its column moves to the matching locales table (`pages__$$locales`, `pages__$blocks_note__$$locales`, `pages__$tree_links__$$locales`), and the migration drops the old column without carrying its values: copy them over before applying it, for example `UPDATE "pages__$$locales" SET meta__seo__title = (SELECT meta__seo__title FROM pages WHERE pages.id = "pages__$$locales".owner_id);`.
