---
'rimecms': patch
---

Fixed: a custom panel route imports its component by a relative path, so a component from a package resolves in dev and in `vite build`, and a lowercase or kebab-case file name works. A component with no file to import logs an error.
