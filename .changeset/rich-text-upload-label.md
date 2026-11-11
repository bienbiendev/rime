---
'rimecms': minor
---

Added: a rich-text `upload()` takes a `label` for its palette entry, as `resource()` does: `upload({ source: 'medias', label: 'Image' })`. Without one, the entry reads the collection slug, where it read "Media" in every language.
