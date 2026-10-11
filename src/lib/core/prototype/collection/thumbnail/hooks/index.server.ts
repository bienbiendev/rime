/**
 * This feature's hooks, by name, so a prototype can place them as `thumbnail.someHook`.
 *
 * A barrel and nothing else.
 * It exists because a prototype's `hooks.server.ts` writes the run order and would otherwise carry
 * one import line per hook.
 */
export { setDocumentThumbnail } from './set-document-thumbnail.server.js';
