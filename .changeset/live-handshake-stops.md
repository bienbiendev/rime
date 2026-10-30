---
'rimecms': patch
---

Fixed: the live page stops asking its preview for the handshake once the preview answers or the page is left. A preview that never answered left a 300 ms timer running for the rest of the session, one more on each visit of the live page.
