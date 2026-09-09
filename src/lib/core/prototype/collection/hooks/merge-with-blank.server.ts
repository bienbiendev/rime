import { createBlankDocument } from '$lib/core/prototype/doc.js';
import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { omit, pick } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import deepmerge from 'deepmerge';

export const mergeWithBlankDocument = Hooks.beforeCreate({
  name: 'mergeWithBlankDocument',
  run: async (args) => {
    const blank = createBlankDocument(args.config, args.event) as Dic;
    const known = Object.keys(blank);
    const data = args.data as Dic;

    /**
     * The blank is built from the config's fields, so only the keys it has are keys there is
     * anything to merge *with*. Everything else is carried across rather than through.
     *
     * That is not a micro-optimisation, it is the fix for what used to be written here as a
     * special case: `deepmerge` clones every plain object it walks, and `file` — the upload
     * payload, which is not a field on any config — came out the other side as a plain object with
     * none of a `File`'s methods. So the hook lifted `file` out before the merge and put it back
     * after, behind `config.type === 'collection' && isUploadConfig(config)`, which is this
     * prototype naming a feature to protect one key.
     *
     * It never needed to name it. A value the blank has no key for has nothing to be merged into,
     * and passing it through a deep merge to arrive unchanged is the only reason it could arrive
     * changed.
     */
    return {
      ...args,
      data: {
        ...deepmerge(blank, pick(known, data), { arrayMerge: (_, incoming) => incoming }),
        ...omit(known, data)
      }
    };
  }
});
