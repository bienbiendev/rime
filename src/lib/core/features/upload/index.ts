import { augmentUpload } from './augment.js';
import { augmentDirectories } from './directories.js';

/**
 * The upload feature's **client-visible** half.
 *
 * `factory/config/build.ts` builds the client config and therefore cannot import a `.server.ts`
 * module, so the seams the client build consumes are declared here and `index.server.ts` spreads
 * this and adds the server-only ones on top.
 *
 * That gives the feature three entry points, each narrower than the last — and the narrowing is
 * forced by real constraints rather than by a template:
 *
 * - `index.ts` (this file)   — what the client bundle may see
 * - `runtime.server.ts`      — what pipeline.server.ts may see, without closing a cycle
 * - `index.server.ts`        — the whole feature, for boot.server.ts and build.server.ts
 *
 * A feature only grows the files it needs: `url` has no derive and no boot, so it has two.
 */
export const uploadClient = {
  name: 'upload',
  appliesTo: ['collection'],

  enabled: (config: any) => !!config.upload,

  augment: { client: augmentUpload },
  derive: { client: augmentDirectories }
} as const;
