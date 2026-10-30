---
'rimecms': patch
---

Fixed: a `.server.ts` or `.server.js` file in the config folder imports the server half of a config file it uses. A field's `$beforeSave`, or any other `$` hook, set in `fields.ts` and used from `helpers.server.ts` now runs; it was left out because `helpers.server.ts` read the client half.
