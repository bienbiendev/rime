---
'rimecms': patch
---

Fixed: every uploaded file is served with `X-Content-Type-Options: nosniff`, so a browser never guesses another type than the one served, and every file but a PDF with `Content-Security-Policy: sandbox`, so an HTML or SVG file opened at its `/uploads/…` URL runs no script on the site's origin. A PDF is left unsandboxed for the browser's viewer to show it. `<img>`, `<video>` and `<audio>` read the files as before.
