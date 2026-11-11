---
'rimecms': minor
---

Added: on a create, a hook's `context.undo` takes the steps that remove what the hook wrote outside rime's tables, `context.undo?.push(() => removeCustomer(id))`. When the create fails before its document exists, rime runs them, newest first. On a read, `context.list` holds `docs`, every document the read builds, and `reads`, a map in which their `beforeRead` hooks can share one read.
