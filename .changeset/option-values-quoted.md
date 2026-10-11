---
'rimecms': patch
---

Fixed: a select, combobox or radio option holding a quote, such as `l'été`, is written as a valid string literal in the generated types, which no longer fail to compile.
