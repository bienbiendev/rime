---
'rimecms': patch
---

Fixed: saving a relation hung on Bun. The existence check forwarded the incoming request's `content-length` on a bodiless GET, which Bun's fetch sends as is, so the server waited for a body that never came.
