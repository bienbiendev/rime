---
'rimecms': patch
---

Fixed: `object.setValueAtPath` replaces a parent that cannot hold a key, such as a string, with an object or a list, as it does for a falsy one. It used to set nothing.
