---
'rimecms': patch
---

Fixed: a resource in rich text follows its document. A rich-text resource node stores the document's `id`, and a read fills `title`, `_type` and `_thumbnail` from the document as the reader sees it now: its thumbnail is the current one after `rime uploads:move`, and a document the reader may not read gives `null` for all three instead of its title and thumbnail.
