import type { BuiltCollection } from '$lib/core/config/types.js';
import { VERSIONS_STATUS } from '$lib/core/constant.js';
import { buildConfigMap } from '$lib/core/operations/configMap/index.js';
import { isBlocksFieldRaw, type BlocksFieldRaw } from '$lib/fields/blocks/index.js';
import { isTreeFieldRaw, type TreeFieldRaw } from '$lib/fields/tree/index.js';

import {
  getValueAtPath,
  isObjectLiteral,
  matchStructure,
  omitId,
  setValueAtPath
} from '$lib/util/object.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';

type DeleteArgs = {
  id: string;
  config: BuiltCollection;
  event: RequestEvent & { locals: App.Locals };
  isSystemOperation?: boolean;
};

// If block is localized should not keep its id so it created a new one
// If block is not localized than it should keep its id so block is updated

export const duplicate = async (args: DeleteArgs): Promise<string> => {
  const { config, event, id } = args;
  const { rime } = event.locals;

  /**
   * Set a copy title, ex: Current Title (copy)
   * on the given document
   */
  function setCopyTitle(doc: Dic) {
    const title = getValueAtPath<string>(config.asTitle, doc);
    const data = setValueAtPath<Dic>(config.asTitle, doc, title + ' (copy)');
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
    data.satus = data.satus ? VERSIONS_STATUS.DRAFT : undefined;
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

  // Fetch document to copy
  const document = await collection.findById({ id, locale: defaultLocale });
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
    const configMap = buildConfigMap(
      source,
      config.fields.map((f) => f.compile())
    );

    // Id mapping
    for (const [key, field] of Object.entries(configMap)) {
      // Process only tree and blocks
      if (!isBlocksFieldRaw(field) && !isTreeFieldRaw(field)) continue;

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
          const matchBlockType = (a: Dic, b: Dic, f: BlocksFieldRaw | TreeFieldRaw) =>
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

      handleField[field.localized ? 'localized' : 'unlocalized']();
    }

    // Prepare data
    const data = prepareDuplicate(source, locale, true);

    // Update document for this locale
    await collection.updateById({ id: newDocument.id, data, locale });
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
