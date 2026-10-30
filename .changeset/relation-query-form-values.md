---
'rimecms': minor
---

Breaking Change: the function given to a relation's `query()` takes the form values, typed `Record<string, any>`, as the panel passes them, where it was typed as a document of the related collection. `RelationField` and `RelationFieldBuilder` take no type parameter: a project that writes `RelationField<X>` or `RelationFieldBuilder<X>` drops the `<X>`.
