import type { BuiltCollection } from '$lib/core/config/types.js';
import { copyLocales } from '$lib/core/locale/copy.server.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import { isJSONContent, richTextJSONToText } from '$lib/fields/rich-text/index.js';
import type { GenericDoc } from '$lib/types';
import { getValueAtPath, isObjectLiteral, setValueAtPath } from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';

export type DuplicateArgs = {
  id: string;
  /** The row to copy. Without it, the newest real version; with it, that row, auto-saved or not. */
  versionId?: string;
};

type Args = DuplicateArgs & { ctx: PrototypeApiContext<BuiltCollection> };

// If block is localized should not keep its id so it created a new one
// If block is not localized than it should keep its id so block is updated

export const duplicate = async (args: Args): Promise<string> => {
  const { ctx, id, versionId } = args;
  const { config, event } = ctx;
  const { rime } = event.locals;

  /**
   * Set a copy title, ex: Current Title (copy)
   * on the given document
   */
  function setCopyTitle(doc: Dic) {
    // For upload collections with no real title field, asTitle falls back to
    // 'filename' (see augmentTitle) — that's a display fallback, not a
    // mutable title. filename must keep matching the actual file on disk
    // (saveFile dedupes by content), so leave it alone rather than
    // corrupting the reference with a suffix no file on disk has.
    if (config.upload && config.asTitle === 'filename') return doc;

    const getTitle = () => {
      const title = getValueAtPath<string>(config.asTitle, doc);
      return isJSONContent(title)
        ? richTextJSONToText(title as any) + ' (copy)'
        : title + ' (copy)';
    };
    const data = setValueAtPath<Dic>(config.asTitle, doc, getTitle());
    return data;
  }

  /**
   * Prepare duplication:
   * - set the copy title
   * - drop what a copy does not inherit
   * - normalize properties
   */
  function prepareDuplicate(doc: Dic, locale: string | undefined) {
    let data = setCopyTitle(doc);
    data = normalizeProps(data, locale);
    delete data.id;
    /**
     * A copy is a new document, so it starts where a new document starts.
     *
     * This was `data.status = data.status ? VERSIONS_STATUS.DRAFT : undefined` — a core operation
     * naming a feature's vocabulary to say "a copy of a published document is not published".
     * True, and not this operation's rule: the feature that adds `status` already declares its
     * default, and `setDefaultValues` applies it on every create. Carrying the original's value
     * over is what made the reset necessary.
     *
     * Unconditional, and safe for a config with no such field: `delete` on an absent key is a
     * no-op, which is what the `data.status ?` test was standing in for.
     */
    delete data.status;
    return data;
  }

  // Store currrent locale
  const currentLocale = event.locals.locale;
  // Get the collection api
  const collection = rime.collection(config.slug);
  // Get the defaultLocale to copy first from the default locale
  const defaultLocale = rime.config.getDefaultLocale();
  // Set locale to the default one
  if (defaultLocale) rime.setLocale(defaultLocale);

  // The row asked for, or the newest real one — `latest`, since the source may never have been
  // published.
  const document = await collection.findById({
    id,
    locale: defaultLocale,
    versionId,
    latest: true,
    localeFallback: false
  });
  // Prepare data
  const data = prepareDuplicate(document, defaultLocale);

  // Create document
  const newDocument = (await collection.create({ data, locale: defaultLocale })) as GenericDoc;

  // The other locales, copied from the source onto the new document.
  const otherLocales = rime.config.getLocalesCodes().filter((l) => l !== defaultLocale);
  if (otherLocales.length) {
    await copyLocales({
      event,
      config,
      source: { id, versionId, latest: true },
      target: {
        id: newDocument.id,
        versionId: newDocument.versionId as string | undefined,
        doc: newDocument
      },
      locales: otherLocales,
      prepare: (data) => setCopyTitle(data)
    });
  }
  // Reset event locale
  rime.setLocale(currentLocale);

  return newDocument.id;
};

const normalizeProps = (value: any, locale: string | undefined): any => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeProps(item, locale));
  }
  if (!isObjectLiteral(value)) {
    return value;
  }

  const unwantedProps = ['id', 'ownerId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];

  return Object.entries(value)
    .filter(([key]) => !unwantedProps.includes(key))
    .reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: normalizeProps(value, locale)
      }),
      {}
    );
};
