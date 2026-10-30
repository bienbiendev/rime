---
'rimecms': patch
---

Fixed: the panel's upload drop zone reads a picked file for its preview only when it is an image, so a large video or archive is no longer loaded whole into the browser's memory. A file that cannot be read is no longer handed to the form after the "The file could not be read" message.
