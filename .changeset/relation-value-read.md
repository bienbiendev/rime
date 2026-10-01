---
'rimecms': patch
---

Breaking Change: `RelationValue<T>` is what a read answers, `T[] | RelationRef[]`; a bare id no longer types as a read value. A write takes `RelationInput<T>`, which adds `string | string[]`: `create` and `update` data are typed with it, and so are a relation field's hooks.
