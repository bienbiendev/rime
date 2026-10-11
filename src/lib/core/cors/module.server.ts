// Server half, and no client half to pair it with — a browser has no origin list to enforce — so
// a client build resolves the name to `undefined` and the feature simply carries no `configure`
// there. See `core/dev/codegen/runtime/index.server.ts`.
//
// The handler is not here: `core/handler.server.ts` imports it directly, because that file is
// server-only.
export { configureCors } from './configure.server.js';
