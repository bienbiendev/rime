/**
 * This feature's hooks, by name, so a prototype can place them as `nested.someHook`.
 *
 * A barrel and nothing else. `$rime/modules:` resolves only files named exactly
 * `module(.server).ts`, such as `../module.server.ts`, so it never sees this one.
 * It exists because a prototype's `hooks.server.ts` writes the run order and would otherwise carry
 * one import line per hook.
 */
export { addChildrenProperty } from './add-children.server.js';
export { refuseCyclicParent } from './refuse-cyclic-parent.server.js';
