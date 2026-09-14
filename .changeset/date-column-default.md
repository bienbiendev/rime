---
'rimecms': patch
---

Fixed: a required date field generated `.default(0)` on a `timestamp_ms` column, which drizzle types as `Date`. The schema now writes `.default(new Date(0))`; drizzle-kit stores the same `0`, so no migration follows.
