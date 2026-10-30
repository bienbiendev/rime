---
'rimecms': patch
---

Fixed: a `<LiveProvider>` stops listening to the panel once it unmounts. A provider made again, in a `{#key}` or `{#if}` block, no longer leaves the old one answering the panel's handshake with its old page address.
