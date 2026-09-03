import { text } from '$lib/fields/text/index.js';
import type { Collection } from '$lib/core/config/types.js';

type Input = { $url?: Collection<any>['$url']; fields?: Collection<any>['fields'] };

/**
 * Adds the hidden `url` field a document's computed url is stored in.
 *
 * Applied only to configs that declare `$url` — the feature's `enabled` decides that now, so
 * this no longer re-tests it. See features/url/index.ts.
 */
export const augmentUrl = <T extends Input>(config: T): T => ({
  ...config,
  fields: [...(config.fields || []), text('url').localized().hidden()]
});
