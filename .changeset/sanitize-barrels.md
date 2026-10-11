---
'rimecms': patch
---

Fixed: a config file that imports or re-exports a file with `$` properties (an `index.ts` barrel) gets a server copy pointing at the server halves. The server read the panel's copy, without `$url`, `$hooks` or `$beforeSave`.
