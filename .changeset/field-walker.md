---
'rimecms': patch
---

Fixed: a `tabs` field nested inside a group or a block now keys its children under the full path instead of dropping the prefix, and a group, tabs or blocks field inside a tree row gets the config-map entries it never had — its children's hooks, access checks, default values and validation run like anywhere else. `getFieldAtPath` also resolves a path deeper in a tree, `footer.nav.0._children.1.label`, which returned `undefined` before.
