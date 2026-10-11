---
'rimecms': minor
---

Breaking Change: duplicating a document of an auth or upload collection answers 400 through the API, as the panel already refused it. An auth document is a user with an account, and an upload document is a file on disk.
