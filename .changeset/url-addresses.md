---
'rimecms': major
---

Breaking Change: a collection with `$url` keeps each page's address in a table of its own, one row
per page and per locale, shared by its versions. `$url` receives `{ path, slug, locale, doc }` and
formats them: `` $url: ({ path, locale }) => `/${locale}/${path.join('/')}` ``. `[...parent.x]` is
gone, the parents' slugs are `path`. Pages get a built-in slug, from their own slug field or their
title, and `url`, `_urlPath` and `_slug` on their documents. A relative url is stored absolute.
The next `rime generate` writes the migration that creates the table. Existing pages get their
address on the first request after the upgrade.
