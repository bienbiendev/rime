import { augmentUpload, bootUpload, configureUploadDirectories, uploadHooks } from '$rime/modules';
import { defineFeature } from '../define.js';

/**
 * Files on disk, and the fields and hooks that put them there.
 *
 * The feature that exercises the whole contract: it augments a collection's fields, contributes
 * hooks at four timings, derives a companion `<slug>Directories` collection from the whole config,
 * and needs a directory to exist before any request is served.
 *
 * `augmentUpload` differs between client and server — the server half adds `_path`'s foreign key —
 * and `uploadHooks` exists only on the server. Both come through `$rime/modules`, so this stays
 * one definition rather than a pair that has to be kept in step.
 */
export const upload = defineFeature({
  type: 'augment',
  extends: ['collection'],
  requires: [],

  /** A config uses this feature by declaring `upload`. */
  enabled: (config) => !!config.upload,

  augment: (config) => augmentUpload(config),

  // Every one of these is read at call time, not at module scope. `configureUploadDirectories`
  // comes from a module that imports the pipeline, which imports this feature back, so the
  // barrel evaluates this definition mid-cycle — and which of upload's modules have been reached
  // by then is an accident of scan order. See the note on `hooks` in ../define.ts.
  configure: (config) => configureUploadDirectories(config),

  boot: (config) => bootUpload(config),

  hooks: () => uploadHooks
});
