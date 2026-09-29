/**
 * This feature's hooks, by name, so a prototype can place them as `url.someHook`.
 *
 * A barrel and nothing else — `module.server.ts` beside it is the pair half `$rime/modules:` resolves, and
 * only files named exactly `module(.server).ts` are, so this one is invisible to that mechanism.
 * It exists because a prototype's `hooks.server.ts` writes the run order and would otherwise carry
 * one import line per hook.
 */
export { createPaths } from './create-paths.server.js';
export { detachPaths } from './detach-paths.server.js';
export { setAreaUrl } from './set-area-url.server.js';
export { setLiveUrl } from './set-live-url.server.js';
export { syncPaths } from './sync-paths.server.js';
