---
'rimecms': patch
---

Fixed: a cached read answers the same document as the read it saved. With the disk strategy, dates stay dates instead of strings; with the memory strategy, each request gets its own copy, so a change one request makes never shows in the next.
