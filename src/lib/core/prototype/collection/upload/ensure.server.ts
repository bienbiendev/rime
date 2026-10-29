import { mediasDirectory } from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import type { BuiltCollection } from '#lib/types.js';
import { existsSync, mkdirSync } from 'node:fs';

/**
 * Creates `storage/uploads/<folder>` for each upload collection. A versions collection's files
 * live in its document's folder. Runs once at boot, through `bootUpload`.
 */
export function ensureMedias<C extends { collections?: BuiltCollection[] }>(config: C) {
  for (const collection of config.collections || []) {
    if (!collection.upload || collection._shadowOf) continue;
    const mediasFolder = mediasDirectory(collection);
    if (!existsSync(mediasFolder)) {
      mkdirSync(mediasFolder, { recursive: true });
    }
  }
}
