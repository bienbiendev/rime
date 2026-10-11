---
'rimecms': patch
---

Fixed: a server-only declaration that reads its own name, such as `const setHome = Hooks.beforeUpsert(async function setHome(args) {…})` or a helper that calls itself, is left out of the panel's copy of the config. It stayed there with its server imports, and the panel failed to load.
