/**
 * This feature's hooks, by name, so a prototype can place them as `versions.someHook`.
 *
 * A barrel and nothing else — `module.server.ts` beside it is the pair half `$rime/modules:` resolves, and
 * only files named exactly `module(.server).ts` are, so this one is invisible to that mechanism.
 * It exists because a prototype's `hooks.server.ts` writes the run order and would otherwise carry
 * one import line per hook.
 */
export { defineVersionOperation } from './define-version-operation.server.js';
export { demoteOtherVersions } from './demote-other-versions.js';
export { exposeVersionId } from './expose-version-id.js';
export { handleNewVersion } from './handle-new-version.server.js';
