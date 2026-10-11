---
'rimecms': patch
---

Fixed: a resolved reference sent as a number, such as `{ author: 42 }` or `{ author: { id: 42 } }` on an app's `text('author').$references('staff', { resolve: true })`, is refused with a 400 instead of silently clearing the stored reference.
