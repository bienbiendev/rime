import { blankAuthDocument } from '$rime/modules';
import { isAuth } from '$lib/core/auth/enabled.js';
import { blankVersion } from '$lib/core/versions/blank.js';
import type { BlankIntent } from './types.js';
import type { Dic } from '$lib/util/types.js';

/**
 * A blank document, after everything that shapes one has.
 *
 * Two steps, and they are the whole list: `auth` strips its private members from what the local
 * API hands out, `versions` publishes the row `boot` writes for a singleton that has none yet.
 * `intent` says which blank this is.
 *
 * Was `blankWithFeatures`, a fold over every feature calling a `blank` seam on the two that had
 * one.
 *
 * **`.server.ts`, and that is load-bearing.** This reaches `$rime/modules`, and it lived in
 * `prototype/doc.ts` for one commit — a file the panel imports. That dragged the whole module
 * barrel into the browser graph and the bundle came back with
 * `ReferenceError: Cannot access 'LIVE_KEY' before initialization`: a TDZ cycle through
 * `panel/index.ts`. Nothing static saw it; two panel tests timed out, a different two each run.
 * Both callers are server-only, so this file is too.
 */
export const shapeBlank = (doc: Dic, config: Dic, intent: BlankIntent): Dic => {
  const withoutPrivateFields = isAuth(config) && blankAuthDocument ? blankAuthDocument(doc) : doc;
  return blankVersion(withoutPrivateFields, config, intent);
};
