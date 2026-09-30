import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { withDefaultValues } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';

/**
 * Gives a create the fields the caller did not send, from the initial document: each field's
 * default, `null` without one. A field sent, empty included, is kept as sent.
 *
 * ```ts
 * text('title').defaultValue('Untitled');
 * // POST {}               -> { title: 'Untitled' }
 * // POST { title: null }  -> { title: null }
 * ```
 *
 * An upload's `File` is not a plain object and is not walked, a key no field declares has no
 * initial value to fill from. The data's own nested objects are shared with the caller's payload
 * from here on, not copied.
 */
export const mergeWithInitialDocument = Hooks.beforeCreate(
  async function mergeWithInitialDocument(args) {
    const initial = args.config.initial(args.event) as Dic;
    return { ...args, data: withDefaultValues(args.data as Dic, initial) };
  }
);
