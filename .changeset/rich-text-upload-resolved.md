---
'rimecms': patch
---

Fixed: an image in rich text follows its media. A rich-text upload node stores the media's `id` and its `legend`, and a read fills `url`, `sizes`, `title`, `mimeType` and `filename` from the media as it is now. After `rime uploads:move` or a privacy change, its URL is the media's current one, and a private media's image goes only to callers who may read it: for anyone else those attributes are `null`.
