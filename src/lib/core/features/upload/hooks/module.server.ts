import type { BuiltCollection } from '$lib/core/factory/config/types.js';
import { ensureMedias } from '../ensure.server.js';
import { cleanUpFiles } from './clean-up-files.server.js';
import { castBase64ToFile } from './convert-base64.server.js';
import { handlePathCreation } from './handle-path-creation.server.js';
import { populateSizes } from './populate-sizes.server.js';
import { processFileUpload } from './process-file-upload.server.js';

/**
 * Upload's server-only contributions: what it adds to the document pipeline, and its boot step.
 *
 * Separate from `../module.server.ts` because that one has a client half. `$rime/modules` exports
 * the client half's names on a client build, so a name only the server half declares would be
 * missing there rather than stubbed — a module with no client half at all is what gets stubbed.
 * See features/nested/hooks/module.server.ts for the same note.
 */

/**
 * `operations/pipeline.server.ts` still decides where each of these runs; the feature only says
 * what they are, and `enabled` (see ../index.ts) says when — reproducing the
 * `collection.upload ? …` that guarded every one of these sites.
 *
 * `exctractPath`, `prepareDirectoryChildren` and `updateDirectoryChildren` are deliberately
 * absent: they belong to the *derived* directories collection's pipeline, not to an upload
 * collection's.
 */
export const uploadHooks = {
  beforeRead: [populateSizes],
  beforeCreate: [handlePathCreation, castBase64ToFile, processFileUpload],
  beforeUpdate: [handlePathCreation, castBase64ToFile, processFileUpload],
  beforeDelete: [cleanUpFiles]
};

/**
 * The feature's boot step: make sure the directory uploads are written into exists.
 *
 * It ran as step 3 of boot.server.ts, named there because there was nowhere to declare it. Now
 * boot loops the registry and this is upload's own.
 */
export const bootUpload = (config: { collections?: BuiltCollection[] }) => ensureMedias(config);
