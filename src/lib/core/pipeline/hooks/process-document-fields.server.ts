import { Hooks } from '$lib/core/pipeline/define-hook.js';
import { logger } from '$lib/core/logger.server.js';
import type { GenericBlock } from '$lib/core/prototype/types.js';
import type { Dic } from '$lib/util/types.js';
import { buildConfigMap } from '../config-map/index.js';
import { getDefaultValue } from './set-default-values.server.js';

/**
 * Walks every field of the document on the way out: drops what the reader may not see, fills an
 * empty one from its default, and hands each value to the field's own `hooks.beforeRead`.
 *
 * One copy of the document, walked in place. A config-map key is already normalized, so it is
 * its segments and nothing else; a copy of the document per key was most of this hook.
 */
export const processDocumentFields = Hooks.beforeRead(async function processDocumentFields(args) {
  const { event } = args;
  const doc = { ...args.doc };

  const configMap = buildConfigMap(doc, args.config.fields);

  for (const [key, config] of Object.entries(configMap)) {
    const parts = key.split('.');

    if (!config.use.accessRead(event.locals.user)) {
      deleteAt(doc, parts);
      continue;
    }

    let value = getAt(doc, parts);

    // A field with no hook has nothing to wait for.
    if (value !== undefined && value !== null && config.get.hooks?.beforeRead?.length) {
      value = await config.use.beforeRead(value, {
        event,
        operation: args.context,
        documentId: doc.id
      });
      setAt(doc, parts, value);
    }

    let isEmpty;
    try {
      isEmpty = config.use.isEmpty(value);
    } catch {
      isEmpty = false;
      logger.warn(`Error in config.isEmpty for field ${key}`);
    }

    if (isEmpty && config.get.defaultValue !== undefined) {
      value = await getDefaultValue({ key, config, adapter: args.event.locals.rime.adapter });
      setAt(doc, parts, value);
    }

    if (config.type === 'blocks') {
      const blocks = getAt(doc, parts) as (GenericBlock | undefined)[] | undefined;
      // Filter out possible undefined block or residual
      // Case undefined : When in dev mode, if a block table is deleted in a migration, a blocks array value could includes undefined ex :
      // * blocks: [ { ... }, undefined, { ... } ]
      // * Because blocks are populated based on path.position
      // Case residual : a block type has been removed but was including a relation, this gives ex :
      // * blocks: [ { id:..., values,... }, { image: {...}} ]
      //                                         ^
      // * the image has been placed but the block doesn't exist anymore
      if (blocks) {
        const withoutResidualBlock = blocks
          .filter((b) => b && 'id' in b) // get only blocks that have .id
          .map((b, index) => ({
            ...b,
            position: index
          }));
        setAt(doc, parts, withoutResidualBlock);
      }
    }
  }

  return { ...args, doc };
});

/** The value the segments lead to, `undefined` past a missing one. */
const getAt = (doc: Dic, parts: string[]): unknown => {
  let current: any = doc;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
};

/** Writes at the segments, opening an object — an array before an index — where one is missing. */
const setAt = (doc: Dic, parts: string[], value: unknown) => {
  let current: any = doc;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    if (!current[part]) current[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

/** Removes what the segments lead to; nothing, past a missing one. */
const deleteAt = (doc: Dic, parts: string[]) => {
  let current: any = doc;
  for (const part of parts.slice(0, -1)) {
    if (current === undefined || current === null || !(part in current)) return;
    current = current[part];
  }
  if (current !== undefined && current !== null) delete current[parts[parts.length - 1]];
};
