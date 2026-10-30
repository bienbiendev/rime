---
'rimecms': patch
---

Fixed: a `<LiveEdit>` with no `path`, on a page with no `<LiveProvider>` above it, renders without live editing instead of throwing a `TypeError` in the browser. A whole-document `<LiveEdit>` opens its panel once the page is in live view, and no longer posts to the window of a page shown outside the live page.
