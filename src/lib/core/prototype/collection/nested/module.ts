import { number } from '#lib/fields/number/index.js';
import { text } from '#lib/fields/text/index.js';
import type { Collection } from '#lib/core/config/types.js';

type IncomingConfig = { slug: string; nested?: boolean; fields?: Collection<any>['fields'] };

/**
 * Adds the root-table fields a nested collection is addressed by: who its parent is, and where it
 * sits among its siblings.
 *
 * The client half. `module.server.ts` adds the self-referencing foreign key on `_parent`.
 * `when(isNested, …)` in the collection's `augments` decides whether a config runs this, so there
 * is no condition here.
 */
export const augmentNested = <T extends IncomingConfig>(config: T): T => ({
  ...config,
  fields: [
    ...(config.fields || []),
    text('_parent').hidden().$root(),
    number('_position').defaultValue(0, { fill: 'save' }).hidden().$root()
  ]
});
