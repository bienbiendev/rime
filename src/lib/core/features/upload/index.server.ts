import { defineFeature } from '../index.js';
import { augmentUploadServer } from './augment.server.js';
import { augmentDirectoriesServer } from './directories.server.js';
import { ensureMedias } from './ensure.server.js';
import { uploadClient } from './index.js';
import { uploadRuntime } from './runtime.server.js';

/**
 * The `upload` feature: files, image sizes, and a folder tree per upload collection.
 *
 * The largest feature that still needs no adapter cooperation, which is why it was converted
 * alongside `url` (docs §14.4). It fills every seam except codegen:
 *
 * - **augment** differs client/server — the server variant additionally points `_path` at the
 *   derived directories table with `$references`, which the client build has no use for. That
 *   asymmetry used to be discoverable only by opening both factories; here it is one line.
 * - **derive** produces `<slug>_directories`, a real prototype that flows through the normal
 *   schema loop. This is route 2 of §14.3, and it is why the adapter's own `collection.upload`
 *   branch in generate-schema is dead commented-out code: someone migrated it here and never
 *   wrote the rule down.
 * - **boot** creates `static/medias`. It used to run as a side effect of building the config
 *   object; it is a named step in boot.server.ts now.
 * - **hooks** live in runtime.server.ts and are ordered by pipeline.server.ts.
 *
 * The `_directories` suffix strips `_versions` first (naming.ts), so a versioned upload
 * collection gets `medias_directories`, never `medias_versions_directories`: a folder tree
 * belongs to the library, not to a revision of a file.
 */
export const upload = defineFeature({
  ...uploadClient,
  ...uploadRuntime,

  augment: { ...uploadClient.augment, server: augmentUploadServer },

  derive: { ...uploadClient.derive, server: augmentDirectoriesServer },

  boot: ensureMedias
});
