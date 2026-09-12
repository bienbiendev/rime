import { getFieldAtPath, resolvedReferencesOf } from '$lib/core/fields/util.js';
import { BlocksBuilder } from '$lib/fields/blocks/index.js';
import { getColumns } from 'drizzle-orm';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import type { BuiltArea, BuiltCollection } from '$lib/types.js';
import type { Dic } from '$lib/util/types.js';
import {
  baseTableName,
  childTableNames,
  joinName,
  tableName,
  type TableName
} from './naming.server.js';

/** What a joined target is projected to, beside its `id`: whatever of these its table has. */
const JOINED_COLUMNS = ['name', 'email', 'title', 'filename'];

/**
 * The `with` joining each resolved reference's target onto this table's rows.
 *
 * `table` is the base or the content table. A versioned config keeps its `$root()` references
 * on the first and the rest on the second, so each table is asked only for its own. With a
 * `select`, only the selected ones.
 */
export const resolvedReferenceJoins = (args: {
  table: TableName;
  tables: Dic;
  config: BuiltCollection | BuiltArea;
  select?: string[];
}): Dic => {
  const { table, tables, config, select } = args;
  const isBase = table === baseTableName(config.slug);
  const withParam: Dic = {};

  for (const reference of resolvedReferencesOf(config.fields)) {
    if (config._versions && reference.root !== isBase) continue;
    if (select?.length && !select.includes(reference.path)) continue;

    const target = tables[baseTableName(reference.to)];
    if (!target) continue;

    const targetColumns = Object.keys(getColumns(target));
    const columns = ['id', ...JOINED_COLUMNS.filter((column) => targetColumns.includes(column))];
    withParam[joinName(reference.column)] = {
      columns: Object.fromEntries(columns.map((column) => [column, true]))
    };
  }

  return withParam;
};

export const buildWithParam = (args: {
  table: TableName;
  select?: string[];
  locale?: string;
  tables: any;
  config: BuiltCollection | BuiltArea;
}) => {
  const { table, select = [], locale, tables, config: documentConfig } = args;
  if (!select.length) {
    return {
      ...buildFullWithParam({ table, locale, tables }),
      ...resolvedReferenceJoins({ table, tables, config: documentConfig })
    };
  }

  const withParam: Dic = resolvedReferenceJoins({ table, tables, config: documentConfig, select });

  // Track paths for different field types
  const directRelationPaths: string[] = [];
  const blockPaths: string[] = [];
  const treePaths: string[] = [];

  for (const path of select) {
    // Convert dot notation to double underscore notation for SQLite queries
    const sqlPath = path.replace(/\./g, '__');

    const fieldConfig = getFieldAtPath(path, documentConfig.fields);

    if (fieldConfig instanceof RelationFieldBuilder) {
      // Handle relation fields
      directRelationPaths.push(path);
    } else if (fieldConfig instanceof BlocksBuilder) {
      // Handle blocks fields
      blockPaths.push(path);
      const blocksTables = childTableNames(table, 'blocks', tables);
      for (const blocksTable of blocksTables) {
        if (!withParam[blocksTable]) {
          let params: Dic = { orderBy: { position: 'asc' } };
          const columns = getColumns(tables[blocksTable]);
          const hasLocale = Object.keys(columns).includes('locale');

          if (locale && hasLocale) {
            params = { ...params, where: { locale } };
          }

          withParam[blocksTable] = params;

          // Handle localized blocks
          const localesBlockTable = tableName({ owner: blocksTable, branch: 'locales' });
          if (locale && localesBlockTable in tables) {
            withParam[blocksTable] = {
              ...withParam[blocksTable],
              with: {
                [localesBlockTable]: {
                  where: { locale }
                }
              }
            };
          }
        }
      }
    } else if (fieldConfig instanceof TreeBuilder) {
      // Handle tree fields
      treePaths.push(path);
      const treeTables = childTableNames(table, 'tree', tables);
      for (const treeTable of treeTables) {
        if (!withParam[treeTable]) {
          let params: Dic = { orderBy: { position: 'asc' } };
          const columns = getColumns(tables[treeTable]);
          const hasLocale = Object.keys(columns).includes('locale');

          if (locale && hasLocale) {
            params = { ...params, where: { locale } };
          }

          withParam[treeTable] = params;

          // Handle localized trees
          const localesTreeTables = tableName({ owner: treeTable, branch: 'locales' });
          if (locale && localesTreeTables in tables) {
            withParam[treeTable] = {
              ...withParam[treeTable],
              with: {
                [localesTreeTables]: {
                  where: { locale }
                }
              }
            };
          }
        }
      }
    } else if (fieldConfig) {
      // Handle regular fields
      if (fieldConfig.get.localized && locale) {
        const localesTableName = tableName({ owner: table, branch: 'locales' });
        if (localesTableName in tables) {
          if (withParam[localesTableName]) {
            withParam[localesTableName].columns = {
              ...withParam[localesTableName].columns,
              [sqlPath]: true
            };
          } else {
            withParam[localesTableName] = {
              where: { locale },
              columns: { [sqlPath]: true }
            };
          }
        }
      }
    }
  }

  // Compute direct relationships if defined
  // this ensure we only fetch the necessary relations
  if (directRelationPaths.length) {
    withParam[tableName({ owner: table, child: { kind: 'rels' } })] = {
      where: { OR: directRelationPaths.map((path) => ({ path })) },
      orderBy: { path: 'asc', position: 'asc' }
    };
  }

  // Handle nested relationships

  // 1. Include relations table if container paths exist (blocks or trees).
  //    If container paths are present we include relations for those containers
  //    and also include any direct relation paths.
  if (
    (blockPaths.length > 0 || treePaths.length > 0) &&
    tableName({ owner: table, child: { kind: 'rels' } }) in tables
  ) {
    // Create a where condition that matches relations within any of the container paths,
    // and include direct relation paths as exact matches.
    withParam[tableName({ owner: table, child: { kind: 'rels' } })] = {
      where: {
        OR: [
          // A container's rows sit under its path; a direct relation is the path itself.
          ...[...blockPaths, ...treePaths].map((path) => ({ path: { like: `${path}__%` } })),
          ...directRelationPaths.map((path) => ({ path }))
        ]
      },
      orderBy: { path: 'asc', position: 'asc' }
    };
  }

  // 2. Include tree tables for blocks that might contain trees
  if (blockPaths.length > 0) {
    const treeTables = childTableNames(table, 'tree', tables);
    for (const treeTable of treeTables) {
      if (!withParam[treeTable]) {
        withParam[treeTable] = {
          where: { OR: blockPaths.map((path) => ({ path: { like: `${path}__%` } })) },
          orderBy: { position: 'asc' }
        };

        // Handle localized trees
        const localesTreeTable = tableName({ owner: treeTable, branch: 'locales' });
        if (locale && localesTreeTable in tables) {
          withParam[treeTable] = {
            ...withParam[treeTable],
            with: {
              [localesTreeTable]: {
                where: { locale }
              }
            }
          };
        }
      }
    }
  }

  // 3. Include block tables for trees that might contain blocks
  if (treePaths.length > 0) {
    const blocksTables = childTableNames(table, 'blocks', tables);
    for (const blocksTable of blocksTables) {
      if (!withParam[blocksTable]) {
        withParam[blocksTable] = {
          where: { OR: treePaths.map((path) => ({ path: { like: `${path}__%` } })) },
          orderBy: { position: 'asc' }
        };

        // Handle localized blocks
        const localesBlockTable = tableName({ owner: blocksTable, branch: 'locales' });
        if (locale && localesBlockTable in tables) {
          withParam[blocksTable] = {
            ...withParam[blocksTable],
            with: {
              [localesBlockTable]: {
                where: { locale }
              }
            }
          };
        }
      }
    }
  }

  // If withParam is empty
  if (Object.keys(withParam).length === 0) {
    return undefined;
  }

  return withParam;
};

const buildFullWithParam = ({
  table,
  locale,
  tables
}: {
  table: TableName;
  locale?: string;
  tables: Dic;
}): Dic => {
  const blocksTables = childTableNames(table, 'blocks', tables);
  const treeTables = childTableNames(table, 'tree', tables);

  const withParam: Dic = Object.fromEntries(
    [...blocksTables, ...treeTables].map((key) => {
      const blockOrTreeTable = tables[key];
      type Params = { orderBy: Dic; where?: Dic };
      let params: Params = { orderBy: { position: 'asc' } };
      const columns = getColumns(blockOrTreeTable);
      const hasLocale = Object.keys(columns).includes('locale');
      if (locale && hasLocale) {
        params = { ...params, where: { locale } };
      }
      return [key, params];
    })
  );

  if (locale) {
    const localesTableName = tableName({ owner: table, branch: 'locales' });
    if (localesTableName in tables) {
      withParam[localesTableName] = { where: { locale } };
    }
    for (const blocksTable of blocksTables) {
      const localesBlockTable = tableName({ owner: blocksTable, branch: 'locales' });
      if (localesBlockTable in tables) {
        withParam[blocksTable] = {
          ...withParam[blocksTable],
          with: {
            [localesBlockTable]: {
              where: { locale }
            }
          }
        };
      }
    }
    for (const treeTable of treeTables) {
      const localesTreeTable = tableName({ owner: treeTable, branch: 'locales' });
      if (localesTreeTable in tables) {
        withParam[treeTable] = {
          ...withParam[treeTable],
          with: {
            [localesTreeTable]: {
              where: { locale }
            }
          }
        };
      }
    }
  }

  if (tableName({ owner: table, child: { kind: 'rels' } }) in tables) {
    const tableNameRelationFields = tableName({ owner: table, child: { kind: 'rels' } });
    withParam[tableNameRelationFields] = {
      orderBy: { path: 'asc', position: 'asc' }
    };
  }

  return withParam;
};
