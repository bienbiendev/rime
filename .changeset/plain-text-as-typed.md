---
'rimecms': minor
---

Breaking Change: text, textarea, slug and email fields store their value as typed, and the link field its `value`: `x < y` lost everything after the `<` on save. The panel and the site print these values escaped. A site that renders one with `{@html}` sanitizes it on save itself: `text('bio').$beforeSave(string.sanitize)`, with `string` from `rimecms/util`.
