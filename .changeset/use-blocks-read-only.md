---
'rimecms': minor
---

Breaking Change: `useBlocks(path).blocks`, which a field's `onChange` receives and `DocumentFormContext` types, is typed read-only. Code that changes that array in place, with `push` or `splice`, stops compiling: change a list through `addBlock`, `deleteBlock`, `moveBlock` and `duplicateBlock`.
