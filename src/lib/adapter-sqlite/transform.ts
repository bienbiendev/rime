import type { Config } from '$lib/core/config/types.js';
import { withLocalesSuffix, withVersionsSuffix } from '$lib/core/naming.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type {
  AreaSlug,
  CollectionSlug,
  GenericBlock,
  GenericDoc,
  PrototypeSlug,
  RawDoc
} from '$lib/core/types/doc.js';
import type { Relation } from '$lib/fields/relation/index.js';
import type { Dic } from '$lib/util/types.js';
import type { RequestEvent } from '@sveltejs/kit';
import deepmerge from 'deepmerge';
import { getTableColumns } from 'drizzle-orm';
import { flatten, unflatten } from 'flat';
import { logger } from '../core/logger/index.server.js';
import { extractFieldName } from '../fields/tree/util.js';
import { isObjectLiteral, omit } from '../util/object.js';
import {
  getBlocksTableNames,
  getTreeTableNames,
  makeBlockTableSlug,
  makeTreeTableSlug
} from './generate-schema/util.js';
import { transformDatabaseColumnsToPaths } from './util.js';

/**
 * Facade responsible of converting raw database document
 * with relations, blocks, locales,... related rows
 * to a full document object
 */
export const transformerFacade = <const C extends Config>(args: {
  configCtx: ConfigContext<C>;
  tables: any;
}) => {
  const { configCtx, tables } = args;

  const transformDoc = async <T extends GenericDoc = GenericDoc>(args: {
    doc: RawDoc;
    slug: AreaSlug | CollectionSlug;
    locale?: string;
    event: RequestEvent;
    depth?: number;
    withBlank?: boolean;
  }): Promise<T> => {
    //

    const { slug, locale, event, withBlank = true, depth = 0 } = args;
    const { rime } = event.locals;

    let doc = args.doc;

    const config = configCtx.getBySlug(slug);
    const isVersioned = !!config.versions;
    const tableName = isVersioned ? withVersionsSuffix(slug) : slug;
    const tableNameRelationFields = `${tableName}Rels`;
    const tableNameLocales = withLocalesSuffix(tableName);

    const isLive = event.url.pathname.startsWith('/live');
    const isPanel = event.url.pathname.startsWith('/panel') || isLive;

    let docAPI;
    if (configCtx.isCollection(slug)) {
      docAPI = rime.collection(slug);
    } else {
      docAPI = rime.area(slug);
    }

    const blankDocument = docAPI.blank();

    /** Add localized fields */
    if (locale && tableNameLocales in tables && doc[tableNameLocales]) {
      doc = { ...doc[tableNameLocales][0], ...doc };
      delete doc[tableNameLocales];
      delete doc.ownerId;
    }

    let flatDoc: Dic = flatten(doc);

    // Transform flattened keys from database schema format to document format
    flatDoc = transformDatabaseColumnsToPaths(flatDoc);

    /****************************************************/
    // Blocks handling
    /****************************************************/

    /** Extract all blocks  */
    const blocksTables = getBlocksTableNames(tableName, tables);
    const blocks: Dic[] = blocksTables.flatMap((blockTable) => doc[blockTable] || []);

    /** Place each block in its path */
    for (let block of blocks) {
      const blockLocaleTableName = withLocalesSuffix(makeBlockTableSlug(tableName, block.type));
      if (locale && blockLocaleTableName in tables) {
        block = {
          ...((block[blockLocaleTableName][0] as Partial<GenericBlock>) || {}),
          ...block
        };
        // Set empty locales values to null if not present in the data
        // for exemple : localized block is fetched but some of its locales values hasn't been saved already
        const localesKeys = Object.keys(getTableColumns(tables[blockLocaleTableName])).filter(
          (key) => !['id', 'locale', 'ownerId'].includes(key)
        );
        const nullKeys = Object.fromEntries(localesKeys.map((k) => [k, null]));
        block = {
          ...nullKeys,
          ...block
        };
      }
      block = transformDatabaseColumnsToPaths(block);

      /** Clean */
      const { position, path } = block;
      if (!isPanel) {
        delete block.position;
        delete block.path;
        delete block.ownerId;
        delete block.locale;
      }
      delete block[blockLocaleTableName];

      /** Assign */
      flatDoc[`${path}.${position}`] = block;
    }

    /****************************************************/
    // Tree handling
    /****************************************************/

    /** Extract all blocks  */
    const treeTables = getTreeTableNames(tableName, tables);
    let treeBlocks: Dic[] = treeTables.flatMap((treeTable) => doc[treeTable] || []);

    treeBlocks = treeBlocks.sort((a, b) => a.path.localeCompare(b.path));

    /** Place each treeBlock in its path */
    for (let block of treeBlocks) {
      try {
        const [fieldName] = extractFieldName(block.path);
        const treeBlockLocaleTableName = withLocalesSuffix(makeTreeTableSlug(tableName, fieldName));

        if (locale && treeBlockLocaleTableName in tables) {
          block = {
            ...((block[treeBlockLocaleTableName][0] as Partial<GenericBlock>) || {}),
            ...block
          };
          // Set empty locales values to null if not present in the data
          // for exemple : localized block is fetched but some of its locales values hasn't been saved already
          const localesKeys = Object.keys(getTableColumns(tables[treeBlockLocaleTableName])).filter(
            (key) => !['id', 'locale', 'ownerId'].includes(key)
          );
          const nullKeys = Object.fromEntries(localesKeys.map((k) => [k, null]));
          block = {
            ...nullKeys,
            ...block
          };
        }

        block = transformDatabaseColumnsToPaths(block);

        /** Clean */
        const { position, path } = block;
        if (!block._children) block._children = [];

        if (!isPanel) {
          delete block.position;
          delete block.path;
          delete block.ownerId;
          delete block.locale;
        }

        delete block[treeBlockLocaleTableName];

        /** Assign */
        flatDoc[`${path}.${position}`] = block;
      } catch {
        logger.error('error in ', block.path);
      }
    }

    /** Place relations */
    if (doc[tableNameRelationFields]) {
      for (const relation of doc[tableNameRelationFields]) {
        /** Relation collection key ex: usersId */
        const relationToIdKey = Object.keys(relation).filter(
          (key) => key.endsWith('Id') && key !== 'ownerId' && relation[key] !== null
        )[0] as PrototypeSlug;

        const relationToId = relation[relationToIdKey];
        if (!relationToId) {
          logger.warn(`orphean ${config.slug} relation : ${relation.id}`);
          continue;
        }

        const relationPath: string = relation.path;
        let relationOutput: Relation | GenericDoc | null;

        /** Get relation if depth > 0 */
        if (depth > 0) {
          const relationSlug = relationToIdKey.replace('Id', '') as CollectionSlug;
          relationOutput = await rime
            .collection(relationSlug)
            .findById({ id: relationToId, locale: relation.locale, depth: depth - 1 });
        } else {
          /** Clean relation */
          for (const key of Object.keys(relation)) {
            /** Delete empty [table]Id and null properties from the relation */
            if (relation[key] === null) {
              delete relation[key];
            } else if (key.endsWith('Id') && key !== 'ownerId') {
              relation.relationTo = key.replace('Id', '');
              relation.documentId = relation[key];
              delete relation[key];
            }
          }
          if (!isPanel) {
            delete relation.position;
            delete relation.ownerId;
            delete relation.path;
          }
          relationOutput = relation;
        }

        /** Assign relation */
        if (!relation.locale || relation.locale === locale) {
          const parentPath = relationPath.split('.').slice(0, -1).join('.');
          // If parent path ends with .[digits], it means the relation is inside a blocks/tree array,
          // then check if the parent path exists in the flatDoc.
          if (/.*\.[\d]+$/.test(parentPath)) {
            if (!flatDoc[parentPath]) {
              logger.warn(
                `Orphean ${config.slug} relation at ${relationPath} with id ${relation.id} because parent path ${parentPath} doesn't exist in the document`
              );
              continue;
            }
          }
          flatDoc[relationPath] = [...(flatDoc[relationPath] || []), relationOutput];
        }
      }
    }

    // Clean
    let output: Dic = unflatten(flatDoc);
    /** Remove tree/blocks table keys */
    const keysToDelete: string[] = [...blocksTables, ...treeTables];

    // Remove relation table keys
    if (tableNameRelationFields in output) {
      keysToDelete.push(tableNameRelationFields);
    }

    // Filter out arrays that contains empty elements
    function cleanEmptyElementsInArrays<T>(obj: T): T {
      if (Array.isArray(obj)) {
        return obj
          .map((item) => cleanEmptyElementsInArrays(item))
          .filter((item) => item !== null && item !== undefined) as unknown as T;
      } else if (isObjectLiteral(obj)) {
        const cleanedObj: any = {};
        for (const key in obj) {
          cleanedObj[key] = cleanEmptyElementsInArrays(obj[key]);
        }
        return cleanedObj;
      }
      return obj;
    }
    output = cleanEmptyElementsInArrays(output);

    if (!isPanel || !event.locals.user) {
      keysToDelete.push('editedBy');
    }

    if (withBlank) {
      output = omit(keysToDelete, deepmerge(blankDocument, output, { arrayMerge: (_, y) => y }));
    } else {
      output = omit(keysToDelete, output);
    }

    return output as T;
  };

  return {
    doc: transformDoc
  };
};
