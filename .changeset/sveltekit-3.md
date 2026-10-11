---
'rimecms': minor
---

Breaking Change: rimecms requires SvelteKit 3 (and adapter-node 6, Svelte 5.57.1, Vite 8.0.12). To upgrade an app, run `npx sv migrate sveltekit-3`, install rimecms, then `npx rime init -f`: it keeps what exists and adds `src/env.ts`, which declares the variables rime reads, and `src/params.ts`, which spreads rime's param matchers (an existing `src/params.ts` gets a warning with the two lines to add). The app's own matchers go in that same file, next to `...rime`. Delete the old `src/params/panel.ts`, `collection.ts` and `area.ts`. `ORIGIN` is gone: `rime build -e` writes an `app/index.js` that sends the origin of `SITE_URL` to adapter-node.
