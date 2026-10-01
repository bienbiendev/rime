---
'rimecms': patch
---

Breaking Change: `isRelationPopulated`, `isRelationResolved`, `isRelationUnresolved` and `resolveRelation` are replaced by `Relation`, from `rimecms/public`. `Relation.resolve(value).first()` and `.all()` give the documents a relation holds: at once when the value already holds them, a promise when refs have to be fetched, so `{#await}` server-renders a page read at depth 1. `Relation.isRef(entry)` tells a ref from a document. Before: `{#await resolveRelation(block.image).then((r) => r?.at(0)) then image}`. After: `{#await Relation.resolve(block.image).first() then image}`.
