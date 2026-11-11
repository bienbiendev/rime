---
'rimecms': patch
---

Fixed: when an upload reuses a byte-identical file already on disk and its image sizes fail to generate, the request answers `upload_error`, as a new file does, and the server logs "Error while generating image sizes" with its cause, where it answered an unnamed 500.
