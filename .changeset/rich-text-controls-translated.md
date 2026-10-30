---
'rimecms': patch
---

Fixed: the rich-text editor's node selector ("Paragraph", "Multiple") and its media and resource nodes ("Add a media", "Add a resource", "Set legend", "Media legend") read in the panel's language, and a media node's image takes its legend as `alt`. The palette entry of `upload()` no longer reads "Media" in every language: it takes a `label`, as `resource()` does, and reads the collection slug without one: `upload({ source: 'medias', label: 'Image' })`.
