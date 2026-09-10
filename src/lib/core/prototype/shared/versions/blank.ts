import { VERSIONS_STATUS } from './constant.js';
import type { Dic } from '$lib/util/types.js';

/**
 * A bootstrapped document's first version is the published one.
 *
 * Otherwise the row exists and no default read can see it, since a default read narrows to
 * `status = published`. The `status` field's own default is `draft`, which is right for every
 * version made after this one.
 *
 * There was a `BlankIntent` parameter saying which blank this is. It had one interesting value:
 * only `boot` seeds a row, only an area is booted, and a create never publishes. So the caller is
 * the answer — this one is `ensureExists`, and nothing else calls it.
 */
export const blankVersion = (doc: Dic, config: Dic): Dic =>
  (config.versions as { draft?: boolean } | undefined)?.draft
    ? { ...doc, status: VERSIONS_STATUS.PUBLISHED }
    : doc;
