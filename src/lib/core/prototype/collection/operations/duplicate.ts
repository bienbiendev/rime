import type { BuiltCollection } from '$lib/core/config/types.js';
import { VERSIONS_STATUS } from '$lib/core/constants.js';
import { buildConfigMap } from '$lib/core/pipeline/config-map/index.js';
import { BlocksBuilder } from '$lib/fields/blocks/index.js';
import { isJSONContent, richTextJSONToText } from '$lib/fields/rich-text/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import {
  getValueAtPath,
  isObjectLiteral,
  matchStructure,
  omitId,
  setValueAtPath
} from '$lib/util/object.js';
import type { PrototypeApiContext } from '$lib/core/prototype/define.js';
import type { Dic } from '$lib/util/types.js';

export type DuplicateArgs = {
  id: string;
};

type Args = DuplicateArgs & { ctx: PrototypeApiContext<BuiltCollection> };

// If block is localized should not keep its id so it created a new one
// If block is not localized than it should keep its id so block is updated

export const duplicate = async (args: Args): Promise<string> => {
  const { ctx, id } = args;
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
   * Prepare duplcation :
   * - set the copy title
   * - set status to draft if needed
   * - normalize properties
   */
  function prepareDuplicate(doc: Dic, locale: string | undefined, keepIds: boolean) {
    let data = setCopyTitle(doc);
    data.status = data.status ? VERSIONS_STATUS.DRAFT : undefined;
    data = normalizeProps(data, locale, keepIds);
    delete data.id;
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

  // Fetch document to copy — draft: true, since the source document may
  // never have been published (buildPublishedOrLatestVersionParams treats a
  // missing draft flag as "published only" for versioned-with-draft
  // collections, which would 404 on a draft-only source).
  const document = await collection.findById({ id, locale: defaultLocale, draft: true });
  // Prepare data
  const data = prepareDuplicate(document, defaultLocale, false);

  // Create document
  const newDocument = await collection.create({ data, locale: defaultLocale });

  // Now update the created document with other locales data
  // Get all locales
  const allLocales = rime.config.getLocalesCodes();
  const otherLocales = allLocales.filter((l) => l !== defaultLocale);

  for (const locale of otherLocales) {
    // set the event locale for next operations
    rime.setLocale(locale);

    // Get localized document
    let source = await collection.findById({ id, locale, draft: true });
    const configMap = buildConfigMap(source, config.fields);

    // Id mapping
    for (const [key, field] of Object.entries(configMap)) {
      // Process only tree and blocks
      if (!(field instanceof BlocksBuilder) && !(field instanceof TreeBuilder)) continue;

      const handleField = {
        // For localized blocks just remove the id so a new one will be created
        localized: () => {
          let value = getValueAtPath<Dic[]>(key, source) ?? [];
          value = value.map((block) => omitId(block));
          source = setValueAtPath(key, source, value);
        },

        // For non localized blocks map original ids in oreder to update incoming blocks
        unlocalized: () => {
          // Function to check block type matching
          const matchBlockType = (a: Dic, b: Dic, f: BlocksBuilder | TreeBuilder) =>
            f.type === 'tree' ? true : a.type === b.type;

          // Get original version blocks
          const defaultLocaleBlocks = getValueAtPath<Dic[]>(key, newDocument) ?? [];

          // loop over blocks
          defaultLocaleBlocks.forEach((block, index) => {
            // get source block at same path
            const sourceBlock = getValueAtPath<Dic>(`${key}.${index}`, source);

            // If structure and type match then copy the original id into source block
            const match =
              sourceBlock &&
              sourceBlock.id &&
              matchStructure(block, sourceBlock) &&
              matchBlockType(sourceBlock, block, field);

            source = match ? setValueAtPath(`${key}.${index}.id`, source, block.id) : source;
          });
        }
      };

      handleField[field.get.localized ? 'localized' : 'unlocalized']();
    }

    // Prepare data
    const data = prepareDuplicate(source, locale, true);

    // Update document for this locale — target newDocument's own version
    // directly (versionId, not draft: true). draft: true with no versionId
    // resolves to NEW_DRAFT_FROM_PUBLISHED, which still fetches the
    // *published* original to branch from; newDocument was just created as
    // a draft copy with no published version yet, so that 404s the same way
    // an unqualified update would.
    await collection.updateById({
      id: newDocument.id,
      data,
      locale,
      versionId: newDocument.versionId as string | undefined
    });
  }
  // Reset event locale
  rime.setLocale(currentLocale);

  return newDocument.id;
};

const normalizeProps = (value: any, locale: string | undefined, keepIds: boolean): any => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeProps(item, locale, keepIds));
  }
  if (!isObjectLiteral(value)) {
    return value;
  }

  const unwantedProps = ['ownerId', 'createdAt', 'updatedAt'];
  if (!keepIds) unwantedProps.push('id');

  return Object.entries(value)
    .filter(([key]) => !unwantedProps.includes(key))
    .reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: normalizeProps(value, locale, keepIds)
      }),
      {}
    );
};
