/**
 * This feature's hooks, by name, so a prototype can place them as `title.someHook`.
 *
 * A barrel and nothing else: a prototype's `hooks.server.ts` writes the run order and imports this
 * once rather than one line per hook.
 */
export { setDocumentTitle } from './set-document-title.server.js';
