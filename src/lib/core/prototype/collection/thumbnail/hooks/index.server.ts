/**
 * This feature's hooks, by name, so a prototype can place them as `thumbnail.someHook`.
 *
 * A barrel and nothing else — `module.server.ts` beside it is the pair half `$rime/modules:` resolves, and
 * only files named exactly `module(.server).ts` are, so this one is invisible to that mechanism.
 * It exists because a prototype's `hooks.server.ts` writes the run order and would otherwise carry
 * one import line per hook.
 */
export { setDocumentThumbnail } from './set-document-thumbnail.server.js';
