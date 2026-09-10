import { VERSIONS_STATUS } from './constant.js';
import type { BlankIntent } from '$lib/core/prototype/doc.js';
import type { Dic } from '$lib/util/types.js';

/**
 * A bootstrapped document's first version is the published one.
 *
 * Otherwise the row exists and no default read can see it, since a default read narrows to
 * `status = published`. The `status` field's own default is `draft`, which is right for every
 * version made after this one — hence the intent.
 */
export const blankVersion = (doc: Dic, config: Dic, intent: BlankIntent): Dic =>
  intent === 'seed' && (config.versions as { draft?: boolean } | undefined)?.draft
    ? { ...doc, status: VERSIONS_STATUS.PUBLISHED }
    : doc;
