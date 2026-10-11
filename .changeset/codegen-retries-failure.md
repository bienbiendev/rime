---
'rimecms': patch
---

Fixed: a code generation step that fails in development (the routes, a migration, the types) runs again at the next start. It was taken as done until the config changed.
