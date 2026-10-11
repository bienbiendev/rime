---
'rimecms': minor
---

Changed: an area with `$url` stores its url when it is saved, in a `<area>__$paths` table with one row per locale, as a collection's pages do, and a read joins it: `select: ['url']` answers it. The url is formatted from the area's published document, so a read of a draft shows the published url, and a change to `$url` or to `SITE_URL` shows after the area's next save. A project with such an area needs a migration for the new table: run `bun rime generate`, then drizzle-kit, as for any new table. The rows are written on the first request after deploy.
