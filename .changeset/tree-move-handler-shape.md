---
'rimecms': minor
---

Breaking Change: `handleNestedDocumentMove` of the panel's collection context, `CONTEXT.COLLECTION` in `rimecms/panel`, takes `{ documentId, parent, order }`: the new parent, `null` for the top, and the ids of its new list, top to bottom. It saves the move with one `POST /api/<collection>/<id>/move` and answers whether the server took it. A plugin that passes `{ documentId, from, to: { parent, index } }` sends the new shape instead.
