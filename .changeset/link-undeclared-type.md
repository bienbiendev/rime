---
'rimecms': patch
---

Fixed: a link field refuses a link whose `type` its `types(...)` do not name, such as `{ type: 'other', value: 'javascript:…' }`, instead of storing it.
