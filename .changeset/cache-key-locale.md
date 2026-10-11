---
'rimecms': patch
---

Fixed: the API cache keys a read on the locale it runs in. A local read without `locale`, such as `rime.area('settings').find()` in a localized layout, served one locale's document to visitors of the other.
