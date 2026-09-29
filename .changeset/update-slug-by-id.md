---
'rimecms': minor
---

Added: `rime.collection(slug).updateSlugById({ id, slug, locale })` and
`PATCH /api/<collection>/<id>/slug` change a page's slug in one locale, on the published page. The
pages under it follow. A slug a sibling holds is refused.
