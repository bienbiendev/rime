---
'rimecms': patch
---

Changed: on a versioned collection, a list filtered on a version field (`?latest=true&where…`, or any `where` on a collection with versions and no drafts) matches each document's newest version only, the one it shows. It matched a document by any of its versions and showed that older version: `?latest=true&where[status][equals]=draft` listed a document published after an older draft.
