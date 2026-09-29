import type { PathRow } from '$lib/core/adapter.js';
import type { BuiltCollection } from '$lib/core/config/types.js';
import { walkFields } from '$lib/core/fields/walk.js';
import { logger } from '$lib/core/logger.server.js';
import type { GenericDoc } from '$lib/core/prototype/types.js';
import { getValueAtPath } from '$lib/util/object.js';
import type { RequestEvent } from '@sveltejs/kit';
import { hasUrl } from './enabled.js';
import { freeSlug, toSlug } from './format.server.js';
import { formatRows, readForUrls } from './refresh.server.js';

/** The locales a page has an address in: `''` when the config has no localization. */
export const addressLocales = (event: RequestEvent) => {
  const codes = event.locals.rime.config.getLocalesCodes();
  return codes.length ? codes : [''];
};

/**
 * The slug a page starts with: the collection's own slug field when it has one, its title
 * otherwise, its id as a last resort.
 */
const initialSlug = (config: BuiltCollection, doc: GenericDoc) => {
  for (const { field, path } of walkFields(config.fields)) {
    if (field.type !== 'slug') continue;
    const value = toSlug(getValueAtPath(path, doc));
    if (value) return value;
  }
  return toSlug(doc.title) || doc.id;
};

/**
 * Gives these pages their address in one locale: a slug free among their siblings, under their
 * parent, then their url.
 *
 * A page is placed once its parent is, so a whole tree goes in, top first, in one call.
 */
const addAddressesIn = async (args: {
  event: RequestEvent;
  config: BuiltCollection;
  ids: string[];
  locale: string;
}) => {
  const { event, config, ids, locale } = args;
  const { paths } = event.locals.rime.adapter;

  const docs = await readForUrls({ event, config, locale, ids });
  const parentOf = (id: string) => (docs.get(id)!._parent as string | null | undefined) ?? null;
  let pending = ids.filter((id) => docs.has(id));
  const inserted: PathRow[] = [];

  while (pending.length) {
    const ready = pending.filter((id) => !pending.includes(parentOf(id) ?? ''));
    if (!ready.length) break;

    for (const id of ready) {
      const parentId = parentOf(id);
      const taken = await paths.siblingSlugs({ slug: config.slug, locale, parentId });
      const slug = freeSlug(initialSlug(config, docs.get(id)!), taken);
      inserted.push(
        ...(await paths.insert({
          slug: config.slug,
          ownerId: id,
          parentId,
          rows: [{ locale, slug }]
        }))
      );
    }
    pending = pending.filter((id) => !ready.includes(id));
  }

  if (pending.length) {
    logger.warn(`${config.slug}: no address for ${pending.join(', ')} in "${locale}"`);
  }
  await formatRows({ event, config, locale, rows: inserted, docs });
};

/** Gives these pages their address in every locale they have none in. */
export const addAddresses = async (args: {
  event: RequestEvent;
  config: BuiltCollection;
  ids: string[];
}) => {
  const { event, config, ids } = args;
  if (!ids.length) return;

  for (const locale of addressLocales(event)) {
    const missing = new Set(
      await event.locals.rime.adapter.paths.missingOwners({ slug: config.slug, locale })
    );
    const idsHere = ids.filter((id) => missing.has(id));
    if (idsHere.length) await addAddressesIn({ event, config, ids: idsHere, locale });
  }
};

/**
 * The document with its address as it now is: the read that produced it ran before a create or an
 * update gave it one.
 */
export const withAddress = async <T extends GenericDoc>(args: {
  event: RequestEvent;
  config: BuiltCollection;
  doc: T;
}): Promise<T> => {
  const { event, config, doc } = args;
  const [row] = await event.locals.rime.adapter.paths.get({
    slug: config.slug,
    ownerId: doc.id,
    locale: (doc.locale as string | undefined) ?? ''
  });
  return { ...doc, url: row?.url ?? null, _urlPath: row?.path ?? null, _slug: row?.slug ?? null };
};

let ensured: Promise<void> | undefined;
let done = false;

/**
 * Once per process, on the first request: every page of a collection with `$url` gets the address
 * it is missing. One query per collection and locale once they all have one. The requests after
 * it are not held: nothing to await once it is done.
 */
export const ensureAddresses = async (event: RequestEvent) => {
  if (done) return;
  ensured ??= (async () => {
    const { rime } = event.locals;
    for (const config of rime.config.raw.collections as BuiltCollection[]) {
      if (!hasUrl(config)) continue;
      const missing = new Set<string>();
      for (const locale of addressLocales(event)) {
        const ids = await rime.adapter.paths.missingOwners({ slug: config.slug, locale });
        ids.forEach((id) => missing.add(id));
      }
      if (!missing.size) continue;
      logger.info(`${config.slug}: giving ${missing.size} pages their address`);
      await addAddresses({ event, config, ids: [...missing] });
    }
  })().then(
    () => {
      done = true;
    },
    (error) => {
      // Tried again on the next request.
      ensured = undefined;
      logger.error(`addresses: ${error.message}`, error);
    }
  );
  await ensured;
};
