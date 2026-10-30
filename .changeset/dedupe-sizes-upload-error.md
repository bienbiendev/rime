---
'rimecms': patch
---

Fixed: when an upload reuses a byte-identical file already on disk and its image sizes fail to generate, the request answers the upload error "Error while generating image sizes", as a new file does, where it answered a raw 500.
