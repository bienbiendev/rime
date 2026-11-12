---
'rimecms': patch
---

Fixed: the package ships the type declarations of the tree field and of the panel tooltip, so `tree('nav').renderTitle(({ values }) => …)` types `values` instead of leaving it an implicit `any`.
