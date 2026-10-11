import { mediasDirectory } from '#lib/core/prototype/collection/upload/disk/medias.server.js';
import type { BuiltCollection } from '#lib/types.js';
import { existsSync, mkdirSync } from 'node:fs';

/**
 * Creates `storage/uploads/<folder>` for each upload collection. A versions collection's files live in its
 * document's folder.
 *
 * Lives with the upload feature rather than in dev/ensure.server.ts: the other ensure*
 * helpers assert that a project was initialised and throw when it wasn't, while this one is
 * a runtime side effect of the upload feature being switched on, and it runs once at boot,
 * through `bootUpload` (`core/boot.server.ts`).
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
