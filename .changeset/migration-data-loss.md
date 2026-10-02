---
'rimecms': patch
---

Added: in development, a migration that drops a table or a column asks before it is applied, `Continue? [y/N]`. No, or no terminal, applies nothing: the migration and the schema are put back and the boot stops. A table drizzle-kit rebuilds to change a column keeps its rows and is not asked about.
