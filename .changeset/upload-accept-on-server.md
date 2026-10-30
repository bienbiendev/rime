---
'rimecms': minor
---

Breaking Change: an upload is checked against `upload.accept` on the server, by the type of the extension it is saved under, and its `mimeType` and `filesize` are the server's own, never the request's. Without `accept`, the files a browser or a server runs are refused: HTML, XHTML, XML, XSL, JavaScript, PHP (`.phtml`, `.phar`, `.php3`…`.php8` too), ASP, JSP, Perl and Python; every image, SVG included, video and audio file is taken. List a type in `accept` to take it, such as `text/html` for HTML.
