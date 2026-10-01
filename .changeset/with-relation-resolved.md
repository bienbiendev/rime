---
'rimecms': patch
---

Breaking Change: `WithRelationPopulated<T>` is `WithRelationResolved<T, D>`, `D` the depth, 1 by default. It walks blocks and trees, which it took for relations before, so a relation inside a block is typed resolved too.
