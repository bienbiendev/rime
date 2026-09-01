import { getFieldAtPath } from '$lib/core/fields/util.js';
import { withLocalesSuffix } from '$lib/core/i18n/naming.js';
import { BlocksBuilder } from '$lib/fields/blocks/index.js';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
import { TreeBuilder } from '$lib/fields/tree/index.js';
import type { BuiltArea, BuiltCollection } from '$lib/types.js';
import type { Dic } from '$lib/util/types.js';
import { asc, eq, getTableColumns, or, SQL } from 'drizzle-orm';
import { childTableNames, tableName } from './naming.server.js';

export const buildWithParam = (args: {
  slug: string;
  select?: string[];
  locale?: string;
  tables: any;
  config: BuiltCollection | BuiltArea;
}) => {
  const { slug, select = [], locale, tables, config: documentConfig } = args;
  if (!select.length) {
    return buildFullWithParam({
      slug,
      locale,
      tables
    });
  }

  const withParam: Dic = {};

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
      const blocksTables = childTableNames(slug, 'blocks', tables);
      for (const blocksTable of blocksTables) {
        if (!withParam[blocksTable]) {
          const blocksTableObj = tables[blocksTable];
          let params: Dic = { orderBy: [asc(blocksTableObj.position)] };
          const columns = getTableColumns(blocksTableObj);
          const hasLocale = Object.keys(columns).includes('locale');

          if (locale && hasLocale) {
            params = { ...params, where: eq(blocksTableObj.locale, locale) };
          }

          withParam[blocksTable] = params;

          // Handle localized blocks
          const localesBlockTable = withLocalesSuffix(blocksTable);
          if (locale && localesBlockTable in tables) {
            withParam[blocksTable] = {
              ...withParam[blocksTable],
              with: {
                [localesBlockTable]: {
                  where: eq(tables[localesBlockTable].locale, locale)
                }
              }
            };
          }
        }
      }
    } else if (fieldConfig instanceof TreeBuilder) {
      // Handle tree fields
      treePaths.push(path);
      const treeTables = childTableNames(slug, 'tree', tables);
      for (const treeTable of treeTables) {
        if (!withParam[treeTable]) {
          const treeTableObj = tables[treeTable];
          let params: Dic = { orderBy: [asc(treeTableObj.position)] };
          const columns = getTableColumns(treeTableObj);
          const hasLocale = Object.keys(columns).includes('locale');

          if (locale && hasLocale) {
            params = { ...params, where: eq(treeTableObj.locale, locale) };
          }

          withParam[treeTable] = params;

          // Handle localized trees
          const localesTreeTables = withLocalesSuffix(treeTable);
          if (locale && localesTreeTables in tables) {
            withParam[treeTable] = {
              ...withParam[treeTable],
              with: {
                [localesTreeTables]: {
                  where: eq(tables[localesTreeTables].locale, locale)
                }
              }
            };
          }
        }
      }
    } else if (fieldConfig) {
      // Handle regular fields
      if (fieldConfig.get.localized && locale) {
        const localesTableName = withLocalesSuffix(slug);
        if (localesTableName in tables) {
          const tableLocales = tables[localesTableName];
          if (withParam[localesTableName]) {
            withParam[localesTableName].columns = {
              ...withParam[localesTableName].columns,
              [sqlPath]: true
            };
          } else {
            withParam[localesTableName] = {
              where: eq(tableLocales.locale, locale),
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
    withParam[tableName({ owner: slug, child: { kind: 'rels' } })] = {
      where: or(...directRelationPaths.map((path) => eq(tables[tableName({ owner: slug, child: { kind: 'rels' } })].path, path))),
      orderBy: [asc(tables[tableName({ owner: slug, child: { kind: 'rels' } })].path), asc(tables[tableName({ owner: slug, child: { kind: 'rels' } })].position)]
    };
  }

  // Handle nested relationships

  // 1. Include relations table if container paths exist (blocks or trees).
  //    If container paths are present we include relations for those containers
  //    and also include any direct relation paths.
  if ((blockPaths.length > 0 || treePaths.length > 0) && tableName({ owner: slug, child: { kind: 'rels' } }) in tables) {
    const relsTable = tables[tableName({ owner: slug, child: { kind: 'rels' } })];

    // Create a where condition that matches relations within any of the container paths,
    // and include direct relation paths as exact matches.
    withParam[tableName({ owner: slug, child: { kind: 'rels' } })] = {
      where: (relation: any, { like, or }: any) => {
        const conditions = [];

        // Add conditions for block paths
        for (const path of blockPaths) {
          conditions.push(like(relation.path, `${path}__%`));
        }

        // Add conditions for tree paths
        for (const path of treePaths) {
          conditions.push(like(relation.path, `${path}__%`));
        }

        // Add direct relation paths if any (exact match via like)
        for (const path of directRelationPaths) {
          conditions.push(eq(relation.path, path));
        }

        return or(...conditions);
      },
      orderBy: [asc(relsTable.path), asc(relsTable.position)]
    };
  }

  // 2. Include tree tables for blocks that might contain trees
  if (blockPaths.length > 0) {
    const treeTables = childTableNames(slug, 'tree', tables);
    for (const treeTable of treeTables) {
      if (!withParam[treeTable]) {
        const treeTableObj = tables[treeTable];

        withParam[treeTable] = {
          where: (tree: any, { like, or }: any) => {
            const conditions = blockPaths.map((path) => {
              return like(tree.path, `${path}__%`);
            });
            return or(...conditions);
          },
          orderBy: [asc(treeTableObj.position)]
        };

        // Handle localized trees
        const localesTreeTable = withLocalesSuffix(treeTable);
        if (locale && localesTreeTable in tables) {
          withParam[treeTable] = {
            ...withParam[treeTable],
            with: {
              [localesTreeTable]: {
                where: eq(tables[localesTreeTable].locale, locale)
              }
            }
          };
        }
      }
    }
  }

  // 3. Include block tables for trees that might contain blocks
  if (treePaths.length > 0) {
    const blocksTables = childTableNames(slug, 'blocks', tables);
    for (const blocksTable of blocksTables) {
      if (!withParam[blocksTable]) {
        const blocksTableObj = tables[blocksTable];

        withParam[blocksTable] = {
          where: (block: any, { like, or }: any) => {
            const conditions = treePaths.map((path) => {
              return like(block.path, `${path}__%`);
            });
            return or(...conditions);
          },
          orderBy: [asc(blocksTableObj.position)]
        };

        // Handle localized blocks
        const localesBlockTable = withLocalesSuffix(blocksTable);
        if (locale && localesBlockTable in tables) {
          withParam[blocksTable] = {
            ...withParam[blocksTable],
            with: {
              [localesBlockTable]: {
                where: eq(tables[localesBlockTable].locale, locale)
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
  slug,
  locale,
  tables
}: {
  slug: string;
  locale?: string;
  tables: Dic;
}): Dic => {
  const blocksTables = childTableNames(slug, 'blocks', tables);
  const treeTables = childTableNames(slug, 'tree', tables);

  const withParam: Dic = Object.fromEntries(
    [...blocksTables, ...treeTables].map((key) => {
      const blockOrTreeTable = tables[key];
      type Params = { orderBy: SQL[]; where?: SQL };
      let params: Params = { orderBy: [asc(blockOrTreeTable.position)] };
      const columns = getTableColumns(blockOrTreeTable);
      const hasLocale = Object.keys(columns).includes('locale');
      if (locale && hasLocale) {
        params = { ...params, where: eq(blockOrTreeTable.locale, locale) };
      }
      return [key, params];
    })
  );

  if (locale) {
    const localesTableName = withLocalesSuffix(slug);
    if (localesTableName in tables) {
      const tableLocales = tables[localesTableName];
      withParam[localesTableName] = { where: eq(tableLocales.locale, locale) };
    }
    for (const blocksTable of blocksTables) {
      const localesBlockTable = withLocalesSuffix(blocksTable);
      if (localesBlockTable in tables) {
        withParam[blocksTable] = {
          ...withParam[blocksTable],
          with: {
            [localesBlockTable]: {
              where: eq(tables[localesBlockTable].locale, locale)
            }
          }
        };
      }
    }
    for (const treeTable of treeTables) {
      const localesTreeTable = withLocalesSuffix(treeTable);
      if (localesTreeTable in tables) {
        withParam[treeTable] = {
          ...withParam[treeTable],
          with: {
            [localesTreeTable]: {
              where: eq(tables[localesTreeTable].locale, locale)
            }
          }
        };
      }
    }
  }

  if (tableName({ owner: slug, child: { kind: 'rels' } }) in tables) {
    const tableNameRelationFields = tableName({ owner: slug, child: { kind: 'rels' } });
    const tableRelationFields = tables[tableNameRelationFields];
    withParam[tableNameRelationFields] = {
      orderBy: [asc(tableRelationFields.path), asc(tableRelationFields.position)]
    };
  }

  return withParam;
};
