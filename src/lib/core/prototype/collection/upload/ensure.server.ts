import type { BuiltCollection } from '$lib/types.js';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Creates static/medias when any collection has upload enabled.
 *
 * Lives with the upload feature rather than in dev/ensure.server.ts: the other ensure*
 * helpers assert that a project was initialised and throw when it wasn't, while this one is
 * a runtime side effect of the upload feature being switched on, and it runs on every config
 * build (see core/config/context.server.ts).
 */
export function ensureMedias<C extends { collections?: BuiltCollection[] }>(config: C) {
  const hasUpload = (config.collections || []).some((collection) => !!collection.upload);
  if (hasUpload) {
    const mediasDirectory = path.resolve(process.cwd(), 'static/medias');
    if (!existsSync(mediasDirectory)) {
      mkdirSync(mediasDirectory, { recursive: true });
    }
  }
}
