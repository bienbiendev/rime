---
'rimecms': patch
---

Fixed: a server-sent events client that stops reading is dropped once 100 frames wait for it, instead of the server queueing every event and keep-alive in memory until it disconnects.
