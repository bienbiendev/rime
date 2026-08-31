import { cleanUpFiles } from './hooks/clean-up-files.server.js';
import { castBase64ToFile } from './hooks/convert-base64.server.js';
import { exctractPath } from './hooks/extract-path.server.js';
import { handlePathCreation } from './hooks/handle-path-creation.server.js';
import { populateSizes } from './hooks/populate-sizes.server.js';
import { processFileUpload } from './hooks/process-file-upload.server.js';
import {
  prepareDirectoryChildren,
  updateDirectoryChildren
} from './hooks/update-directory-children.server.js';

/**
 * The upload feature's **phase 3** half: what it contributes to a request.
 *
 * Split from index.server.ts, and the reason is a genuine constraint rather than tidiness.
 * `operations/pipeline.server.ts` consumes this, and the feature's *boot* seams cannot be
 * reachable from there: `derive` pulls in directories.server.ts, which needs
 * `augmentCollectionHooks` and `directoriesPipeline` from pipeline.server.ts — a derived
 * prototype legitimately depends on the pipeline. Importing the whole feature into the pipeline
 * would close that loop, and because pipeline.server.ts reads `hooks` at module scope, the
 * partially-initialised module would hand it `undefined` rather than fail loudly.
 *
 * So the rule the contract needs: **the runtime attach point may only see the runtime half.**
 * index.server.ts spreads this and adds the boot seams on top; nothing imports in the other
 * direction.
 */
export const uploadRuntime = {
  name: 'upload',
  appliesTo: ['collection'],

  enabled: (config: any) => !!config.upload,

  hooks: {
    // on the upload collection itself
    handlePathCreation,
    castBase64ToFile,
    processFileUpload,
    populateSizes,
    cleanUpFiles,
    // on its derived <slug>_directories collection
    exctractPath,
    prepareDirectoryChildren,
    updateDirectoryChildren
  }
} as const;
