---
'rimecms': patch
---

Fixed: `object.getValueAtPath` and `object.deleteValueAtPath` find nothing on a path that runs through `null` or a primitive. `deleteValueAtPath` no longer throws there, `getValueAtPath` no longer throws on `null`, and it no longer reads a string's own properties: `getValueAtPath('title.length', { title: 'abc' })` is `undefined`, where it was `3`.
