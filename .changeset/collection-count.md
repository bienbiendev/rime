---
'rimecms': patch
---

Added: `GET /api/<collection>/count` answers `{ count }`, the number of documents `GET /api/<collection>` lists for the same `where…` (and `latest` for staff), with the same read access. The local API gains `rime.collection(slug).count({ query, latest })`. The dashboard and the folder tiles of an upload collection count with it instead of reading every document.
