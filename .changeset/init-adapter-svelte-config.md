---
'rimecms': patch
---

Fixed: `rime init` swapped `adapter-auto` for the Node adapter only in `vite.config.ts`, so an app declaring it in `svelte.config.js` kept `adapter-auto`, which builds no server for Node, and re-running `init` never saved the swap. The adapter is now set wherever it is declared, `svelte-adapter-bun` with `--bun`; any other adapter is left alone.
