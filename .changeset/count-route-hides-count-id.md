---
'rimecms': minor
---

Breaking Change: `GET /api/<collection>/count` answers the number of documents, so a document whose id is `count`, which 1.3 made when a create named that id, is no longer read, updated or deleted at `/api/<collection>/count`. Create it again under a new id: the local API still reaches it, `rime.collection('pages').findById({ id: 'count' })` and `deleteById({ id: 'count' })`.
