---
'rimecms': minor
---

Breaking Change: uploaded files move out of `static/medias` to `storage/uploads/<folder>/<file>` at the project root, one folder per upload collection, and their URLs become `/uploads/<folder>/<file>`. `upload.folder` names the folder; it is the collection's kebab by default. Rime serves the files itself. A collection anonymous callers may not read serves its files only to callers who may read a document naming them; anyone else gets 404. No URL reaches `storage/`. Run `rime uploads:move` once to move the existing files.
