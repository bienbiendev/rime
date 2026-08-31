import { defineFeature } from '../index.js';
import { augmentUrl } from './augment.js';
import { urlRuntime } from './runtime.server.js';

/**
 * The `url` feature: give a document a public URL.
 *
 * The smallest feature rime has, and the reference shape — one augment, one hook, nothing else.
 * It contributes storage the adapter-agnostic way (docs §14.3 route 1): `augmentUrl` appends a
 * localized `text('url')` field and the normal column pipeline turns it into a column. The
 * adapter has no idea this feature exists, which is why it was among the first converted.
 *
 * Worth knowing (docs §16.2, finding 3): because that field is localized, switching `$url` on is
 * enough to create a `<owner>Locales` table for a prototype that declares no localized field of
 * its own — `pages_versionsLocales` in the versions-multilang fixture holds exactly `url`.
 */
export const url = defineFeature({
  ...urlRuntime,

  // One function for both sides — nothing about a url field is server-only.
  augment: { client: augmentUrl, server: augmentUrl }
});
