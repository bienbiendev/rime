// Server half. Both are server-only — a browser has no origin list to enforce — so there is no
// client half to pair this with, and a client build resolves both names to `undefined`: the
// feature simply carries no `configure` and no `handler` there. Same shape as `features/url`'s
// hooks. See docs/rime-modules-resolution.md, case C.
export { augmentCORS } from './augment.server.js';
export { handleCORS } from './handler.server.js';
