import type { BuiltCollection, Config } from '$lib/core/config/types.js';
import { logger } from '$lib/core/logger/index.server.js';
import { hasVersionsSuffix, withVersionsSuffix } from '$lib/core/naming.js';
import type { RimeContext } from '$lib/core/rime.server.js';
import type { GenericDoc } from '$lib/core/types/doc.js';
import { existsSync, unlink, unlinkSync } from 'fs';
import path from 'path';
import type { WithUpload } from '../util/config.js';

/**
 * A given filename on disk can be shared by several document rows across
 * unrelated upload collections — saveFile dedupes any byte-identical upload
 * to a single file (see isSameFile). For a versioned collection the root
 * table is just an id/hierarchy envelope — all actual content, including
 * the published state, lives in its `_versions` table — so versioned
 * collections are checked via that sibling, which holds the full history
 * rather than just the one row a base-collection query would join in.
 * `selfId` must already be in whichever id-space `selfSlug` resolves to
 * (a `_versions` row's own id, not the envelope's `id` — see versionId in
 * mergeRawDocumentWithVersion). Every configured locale is checked since a
 * localized collection's query can otherwise miss rows in non-default
 * locales, even though `filename` itself is never a localized field.
 */
const isFilenameStillReferenced = async <C extends Config>(args: {
  rime: RimeContext<C>;
  filename: string;
  selfSlug: string;
  selfId: string;
}): Promise<boolean> => {
  const { rime, filename, selfSlug, selfId } = args;

  const targetSlugs = Object.values(rime.config.collections)
    .filter((c) => c?.upload && !hasVersionsSuffix(c.slug))
    .map((c) => (c.versions ? withVersionsSuffix(c.slug) : c.slug));

  const locales = rime.config.getLocalesCodes();
  const localesToQuery = locales.length ? locales : [undefined];

  for (const slug of targetSlugs) {
    for (const locale of localesToQuery) {
      const docs = await rime.collection(slug).find({
        query: `where[filename][equals]=${filename}`,
        draft: true,
        locale,
        limit: slug === selfSlug ? 2 : 1
      });
      const referenced = docs.some((doc) => slug !== selfSlug || doc.id !== selfId);
      if (referenced) return true;
    }
  }
  return false;
};

export const cleanUpDocumentFile = async <C extends Config>(args: {
  config: WithUpload<BuiltCollection>;
  rime: RimeContext<C>;
  id: string;
}): Promise<GenericDoc> => {
  //
  const { config, rime, id } = args;
  const doc = await rime.collection<any>(config.slug).findById({ id, draft: true });

  try {
    if (!doc.filename) return doc;

    const stillReferenced = await isFilenameStillReferenced({
      rime,
      filename: doc.filename,
      selfSlug: config.versions ? withVersionsSuffix(config.slug) : config.slug,
      selfId: doc.versionId ?? doc.id
    });

    if (stillReferenced) return doc;

    const filePath = path.resolve(process.cwd(), `static/medias/${doc.filename}`);

    // Delete original
    unlinkSync(filePath);

    const unlinkPath = (sizePath: string) => {
      if (existsSync(sizePath)) {
        unlink(sizePath, () => {});
      }
    };

    // Process all entries in doc.sizes
    if (doc.sizes) {
      Object.values(doc.sizes).forEach((path) => {
        if (typeof path === 'string') {
          unlinkPath(`static/${path}`);
        }
      });
    }
  } catch (err: any) {
    logger.error(err);
  }
  return doc;
};
