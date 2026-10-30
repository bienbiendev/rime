---
'rimecms': patch
---

Fixed: a config folder that holds `module.ts` beside `module.server.ts` boots, when `module.ts` holds no server content. Only a file with server content beside an `X.server.ts` of the same name is refused, and the error names both files.
