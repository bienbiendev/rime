/**
 * This feature's hooks, by name, so a prototype can place them as `metas.someHook`.
 *
 * A barrel and nothing else — see the note on `title/hooks/index.server.ts`.
 */
export { deletePanelLockMetas } from './delete-panel-lock-metas.server.js';
export { stampCreatedBy, stampUpdatedBy } from './stamp-authorship.server.js';
