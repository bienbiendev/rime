---
'rimecms': minor
---

Added: a form field takes `$notNull({ default })`, which makes its column `NOT NULL` with `default` as its `DEFAULT`, so the migration that adds the column writes that value into the rows already there: `toggle('archived').$notNull({ default: false })`.
