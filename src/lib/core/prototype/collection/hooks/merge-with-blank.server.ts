import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { createBlankDocument } from '$lib/core/prototype/doc.js';
import { omit, pick } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import deepmerge from 'deepmerge';

/**
 * Merges the incoming data onto a blank document, so a create starts from every field the config
 * declares rather than only the ones the caller sent.
 */
export const mergeWithBlankDocument = Hooks.beforeCreate(
  async function mergeWithBlankDocument(args) {
    const blank = createBlankDocument(args.config, args.event) as Dic;
    const known = Object.keys(blank);
    const data = args.data as Dic;

    /**
     * The blank is built from the config's fields, so only the keys it has are keys there is
     * anything to merge *with*. Everything else is carried across rather than through.
     *
     * That is what keeps a `File` a `File`. `deepmerge` clones every plain object it walks, so an
     * upload payload passed through it would come out with none of a `File`'s methods — and `file`
     * is not a field on any config, so the blank has no key for it and nothing to merge it into.
     */
    return {
      ...args,
      data: {
        ...deepmerge(blank, pick(known, data), { arrayMerge: (_, incoming) => incoming }),
        ...omit(known, data)
      }
    };
  }
);
