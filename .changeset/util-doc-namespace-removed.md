---
'rimecms': major
---

Breaking Change: the `doc` namespace is gone from `rimecms/util`. `util.doc.createBlankDocument(config)`
is now `config.blank()`, and `util.doc.normalizeFieldPath` is now `util.string.normalizeFieldPath`.
`toNestedStructure` moved to the nested feature and is no longer published.
