/**
 * This feature's hooks, by name, so a prototype can place them as `versions.someHook`.
 *
 * A barrel and nothing else: a prototype's `hooks.server.ts` writes the run order and imports this
 * once rather than one line per hook.
 */
export { defineVersionOperation } from './define-version-operation.server.js';
export { demoteOtherVersions } from './demote-other-versions.js';
export { discardAutoSavesOf } from './discard-auto-saves-of.server.js';
export { exposeVersionId } from './expose-version-id.js';
export { handleNewVersion } from './handle-new-version.server.js';
export { preventLastVersionDeletion } from './prevent-last-version-deletion.server.js';
export { stripAutoSaveFlag } from './strip-auto-save-flag.server.js';
