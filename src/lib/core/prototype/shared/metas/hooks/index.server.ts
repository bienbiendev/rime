/**
 * This feature's hooks, by name, so a prototype can place them as `metas.someHook`.
 *
 * A barrel and nothing else: a prototype's `hooks.server.ts` imports it once rather than one line
 * per hook.
 */
export { deletePanelLockMetas } from './delete-panel-lock-metas.server.js';
export { stampCreatedBy, stampUpdatedBy } from './stamp-authorship.server.js';
