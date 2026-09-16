import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { withDefaults } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';

/**
 * Fills the incoming data from a blank document, so a create starts from every field the config
 * declares rather than only the ones the caller sent.
 *
 * What the caller sent is kept as sent: an upload's `File` is not a plain object and is not
 * walked, a key no field declares has no blank to fill from. The data's own nested objects are
 * shared with the caller's payload from here on, not copied.
 */
export const mergeWithBlankDocument = Hooks.beforeCreate(
  async function mergeWithBlankDocument(args) {
    const blank = args.config.blank(args.event) as Dic;
    return { ...args, data: withDefaults(args.data as Dic, blank) };
  }
);
