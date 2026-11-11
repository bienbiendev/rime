---
'rimecms': patch
---

Changed: rimecms pins better-auth and `@better-auth/api-key` to 1.7.20, where they were 1.7.4, and takes nodemailer 10, where it took 8. It no longer installs `@playwright/test`, `autoprefixer`, `postcss-import` or `magic-string-ast` with it: a project that uses one of them adds it to its own package.json.
