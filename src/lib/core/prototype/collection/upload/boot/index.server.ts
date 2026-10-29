import type { BuiltCollection } from '#lib/core/config/types.js';
import { ensureMedias } from '#lib/core/prototype/collection/upload/ensure.server.js';

/**
 * Upload's boot step: creates the folder of each upload collection under `storage/uploads/`.
 *
 * Not in `upload/module.server.ts`: `core/boot.server.ts` imports it, and a name only a server half
 * declares does not exist on a client build.
 */
export const bootUpload = (config: { collections?: BuiltCollection[] }) => ensureMedias(config);
