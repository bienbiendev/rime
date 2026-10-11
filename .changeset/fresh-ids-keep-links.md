---
'rimecms': patch
---

Fixed: a duplicated or pasted block, and content copied from the default locale, keep their rich-text page links and embedded images. Only the blocks, tree items and relation rows get new ids; an `id` inside a rich-text node stays.
