/**
 * This feature's hooks, by name, so a prototype can place them as `url.someHook`.
 *
 * A barrel and nothing else: a prototype's `hooks.server.ts` writes the run order and imports this
 * once rather than one line per hook.
 */
export { createPaths } from './create-paths.server.js';
export { detachPaths } from './detach-paths.server.js';
export { setLiveUrl } from './set-live-url.server.js';
export { syncAreaUrl } from './sync-area-url.server.js';
export { syncPaths } from './sync-paths.server.js';
