/**
 * Server half, with **no `module.ts` beside it**, and that is the whole point.
 *
 * `features/auth/index.ts` is reachable from a client build — a prototype's feature list is, since
 * `create` runs the augments on both sides — so the handler cannot be imported from there by path.
 * It cannot go in `features/auth/module.server.ts` either: that one *has* a client half, and a
 * name only the server half declares is **not exported** on a client build rather than
 * `undefined`, which fails at link time with "does not provide an export named". Same shape as
 * `features/auth/hooks` and `features/cors`. See docs/rime-modules-resolution.md, cases B and C.
 */
export { handleAuth } from './index.server.js';
