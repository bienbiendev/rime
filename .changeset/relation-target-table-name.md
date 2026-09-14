---
'rimecms': patch
---

Fixed: the generated schema referenced a relation target by its slug, so a camelCase collection (`eventsCategories`) produced a junction column pointing at an undeclared `eventsCategories` table instead of `events_categories`.
