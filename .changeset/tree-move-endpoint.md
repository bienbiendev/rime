---
'rimecms': minor
---

Added: `POST /api/<collection>/<id>/move` with `{ parent, order }` moves a page of a nested collection under `parent` (`null` for the top) and stores its new list in the order of `order`, the ids top to bottom, this page among them. It answers `{ doc }`, the moved page. Only that page is updated as a document: the others get their new place and nothing else, and an id of `order` that is not under `parent` is skipped. A collection that is not nested, a `parent` that is neither an id nor `null`, or an `order` that is not a list of ids holding the page answers 400. The caller needs update access to the moved page and to every page whose place changes, or the request answers 403 and nothing is written.
