---
'rimecms': patch
---

Fixed: calling the unsubscribe `openSse` returns a second time does nothing. It used to take a newer stream on the same keys out of the shared list, so the next `openSse` on those keys opened a second `EventSource`.
