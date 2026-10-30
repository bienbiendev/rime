---
'rimecms': patch
---

Fixed: a config folder whose name starts with a dot, such as `RIME_CONFIG_DIR=src/.cms`, is imported as `./.cms.generated/…` in src/hooks.server.ts, src/params.ts and src/app.generated.d.ts, where it was a bare `.cms.generated/…` that Vite looked up as a package.
