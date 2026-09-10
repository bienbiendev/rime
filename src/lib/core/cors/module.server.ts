// Server half, and no client half to pair it with — a browser has no origin list to enforce — so
// a client build resolves the name to `undefined` and the feature simply carries no `configure`
// there. See docs/rime-modules-resolution.md, case C.
//
// The handler is not here: `handlers/index.ts` imports it directly, because that file is
// server-only and a feature no longer carries its handler as a property.
export { configureCors } from './configure.server.js';
