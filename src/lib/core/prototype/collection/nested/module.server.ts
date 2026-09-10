import { number } from '$lib/fields/number/index.js';
import { text } from '$lib/fields/text/index.js';
import type { Collection } from '$lib/core/config/types.js';

type IncomingConfig = { slug: string; nested?: boolean; fields?: Collection<any>['fields'] };

/**
 * The nested feature's server half.
 *
 * Same shape as the client augment, plus the one thing that cannot cross to the browser:
 * `_parent` is a self-referencing foreign key, which is what lets a parent's deletion null its
 * children rather than orphan them. Written out rather than wrapping the client half, because the
 * reference has to be on the builder at construction, not bolted on afterwards.
 */
export const augmentNested = <T extends IncomingConfig>(config: T): T => ({
  ...config,
  fields: [
    ...(config.fields || []),
    text('_parent')
      .$references(config.slug, { onDelete: 'set null', selfReferencing: true })
      .hidden()
      ._root(),
    number('_position').defaultValue(0).hidden()._root()
  ]
});
