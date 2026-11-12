---
'rimecms': patch
---

Fixed: the first request after boot no longer hangs when a `beforeRead` hook fetches one of the app's own routes with `event.fetch`. The sub-request skips the address backfill that the outer request is already running.
