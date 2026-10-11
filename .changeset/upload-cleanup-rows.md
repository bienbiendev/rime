---
'rimecms': patch
---

Fixed: an upload document's files are removed after the write, and only when no row uses them any more. Replacing the file of one version removes that version's old file and leaves the files of the other versions; replacing a file in a new version saves it once and keeps it; deleting a versioned document removes the files of all its versions; `file: null` clears `filename`, `mimeType` and `filesize` with the sizes; the image sizes of a file already missing are removed too.
