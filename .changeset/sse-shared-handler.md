---
'rimecms': patch
---

Fixed: two `openSse` calls with the same handler are two listeners: unsubscribing one leaves the other listening.
