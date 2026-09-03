import { number } from '$lib/fields/number/index.js';
import { text } from '$lib/fields/text/index.js';
import type { Collection } from '$lib/core/config/types.js';

type IncomingConfig = { slug: string; nested?: boolean; fields?: Collection<any>['fields'] };

/**
 * Adds the root-table fields a nested collection is addressed by: who its parent is, and where it
 * sits among its siblings.
 *
 * The client half. `module.server.ts` adds the self-referencing foreign key on `_parent`; the
 * condition lives on the feature's `enabled`, so this no longer re-tests `config.nested`.
 */
export const augmentNested = <T extends IncomingConfig>(config: T): T => ({
  ...config,
  fields: [
    ...(config.fields || []),
    text('_parent').hidden()._root(),
    number('_position').defaultValue(0).hidden()._root()
  ]
});
