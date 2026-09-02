import { defineFeature } from '../define.js';
import { url as base } from './index.js';
import { populateURL } from './hooks/populate-url.server.js';

/**
 * The url feature as the server sees it: the same definition, plus the hook that computes the
 * url on read.
 *
 * `operations/pipeline.server.ts` takes the hook from here and decides where it runs. The feature
 * says what runs and whether — `enabled` is inherited from the base definition, so the condition
 * is written once rather than repeated at each hook site.
 */
export const url = defineFeature({
  ...base,
  hooks: {
    beforeRead: [populateURL]
  }
});
