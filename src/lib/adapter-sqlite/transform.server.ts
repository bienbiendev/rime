import type { DocumentRows } from '$lib/core/adapter.js';
import type { Config } from '$lib/core/config/types.js';
import type { GenericBlock, PrototypeSlug, RawDoc } from '$lib/core/prototype/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';
import { getTableColumns } from 'drizzle-orm';
import { flatten } from 'flat';
import { logger } from '../core/logger.server.js';
import { extractFieldName } from '../fields/tree/util.js';
import { omit } from '../util/object.js';
import {
  baseTableName,
  tableName as buildTableName,
  childTableNames,
  type TableName
} from './naming.server.js';
import { transformDatabaseColumnsToPaths } from './util.server.js';

/**
 * Turns the rows a read returned into the four piles core builds a document from.
 *
 * Everything here needs `tables`: which children hang off this document, which locales branch
 * belongs to which row, which columns a branch has. Everything that did not — the blank merge,
 * the key stripping, the relation assembly, the depth walk — is in
 * `core/pipeline/build-document.server.ts`.
 */
export const transformerFacade = <const C extends Config>(args: {
  configCtx: ConfigContext<C>;
  tables: any;
}) => {
  const { configCtx, tables } = args;

  /**
   * Merges a child row's locales branch onto it, and nulls the localized columns it has not
   * saved yet — a localized block fetched in a locale it was never written in reads as absent
   * columns otherwise, and absent is not null once the blank is merged.
   */
  const withLocalesBranch = (row: Dic, branchTable: TableName): Dic => {
    const merged = {
      ...((row[branchTable]?.[0] as Partial<GenericBlock>) || {}),
      ...row
    };
    const localesKeys = Object.keys(getTableColumns(tables[branchTable])).filter(
      (key) => !['id', 'locale', 'ownerId'].includes(key)
    );
    return {
      ...Object.fromEntries(localesKeys.map((k) => [k, null])),
      ...merged
    };
  };

  const rows = async (args: {
    doc: RawDoc;
    slug: PrototypeSlug;
    locale?: string;
  }): Promise<DocumentRows> => {
    const { slug, locale } = args;

    let doc: Dic = args.doc;

    // The table this document's content is in — its own, unless a feature gave it a shadow.
    const tableName = baseTableName(configCtx.shadowSlugOf(slug) ?? slug);
    const tableNameRelationFields = buildTableName({ owner: tableName, child: { kind: 'rels' } });
    const tableNameLocales = buildTableName({ owner: tableName, branch: 'locales' });

    /** Add localized fields */
    if (locale && tableNameLocales in tables && doc[tableNameLocales]) {
      doc = { ...doc[tableNameLocales][0], ...doc };
      delete doc[tableNameLocales];
      delete doc.ownerId;
    }

    /****************************************************/
    // Blocks
    /****************************************************/

    const blocksTables = childTableNames(tableName, 'blocks', tables);
    const blocks: Dic[] = blocksTables
      .flatMap((blockTable) => doc[blockTable] || [])
      .map((block: Dic) => {
        const branchTable = buildTableName({
          owner: tableName,
          child: { kind: 'blocks', name: block.type },
          branch: 'locales'
        });

        if (locale && branchTable in tables) block = withLocalesBranch(block, branchTable);

        return omit([branchTable], transformDatabaseColumnsToPaths(block));
      });

    /****************************************************/
    // Tree
    /****************************************************/

    const treeTables = childTableNames(tableName, 'tree', tables);
    const tree: Dic[] = treeTables
      .flatMap((treeTable) => doc[treeTable] || [])
      .sort((a: Dic, b: Dic) => a.path.localeCompare(b.path))
      .flatMap((node: Dic) => {
        try {
          const [fieldName] = extractFieldName(node.path);
          const branchTable = buildTableName({
            owner: tableName,
            child: { kind: 'tree', name: fieldName },
            branch: 'locales'
          });

          if (locale && branchTable in tables) node = withLocalesBranch(node, branchTable);

          return [omit([branchTable], transformDatabaseColumnsToPaths(node))];
        } catch {
          logger.error('error in ', node.path);
          return [];
        }
      });

    /****************************************************/
    // Relations
    /****************************************************/

    const relations: Dic[] = ((doc[tableNameRelationFields] as Dic[]) || []).map((relation) =>
      resolveRelationTarget({ ...relation })
    );

    /****************************************************/
    // The document's own columns
    /****************************************************/

    // The child tables came back on the same row; they are their own piles now. Left on, they
    // flatten into `pages__$blocks_hero.0.id` keys that survive every step to be stripped by name
    // at the very end.
    const base = transformDatabaseColumnsToPaths(
      flatten(omit([...blocksTables, ...treeTables, tableNameRelationFields], doc))
    );

    return { base, blocks, tree, relations };
  };

  return { rows };
};

/**
 * Names what a junction row points at.
 *
 * The junction has one nullable foreign key column per target collection — `pagesId`, `mediasId`
 * — and exactly one is set. That shape is the adapter's; `relationTo` and `documentId` are what
 * core reads. Null columns go with it, including the other targets'.
 */
const resolveRelationTarget = (relation: Dic): Dic => {
  const targetKey = Object.keys(relation).filter(
    (key) => key.endsWith('Id') && key !== 'ownerId' && relation[key] !== null
  )[0];

  // No target column set: an orphan. Left as it came so core can name it in the warning.
  if (!targetKey || !relation[targetKey]) return relation;

  for (const key of Object.keys(relation)) {
    if (relation[key] === null) {
      delete relation[key];
    } else if (key.endsWith('Id') && key !== 'ownerId') {
      relation.relationTo = key.replace('Id', '');
      relation.documentId = relation[key];
      delete relation[key];
    }
  }

  return relation;
};
