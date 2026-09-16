import type { NodeStorage } from '$lib/core/fields/builders/field-builder.js';
import type { FormFieldBuilder } from '$lib/core/fields/builders/form-field-builder.js';
import { getFieldAtPath, resolvedReferencesOf } from '$lib/core/fields/util.js';
import { getColumns } from 'drizzle-orm';
import { RelationFieldBuilder } from '$lib/fields/relation/index.js';
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
  /** The references to join at all, by path; every one when absent. */
  resolve?: string[];
}): Dic => {
  const { table, tables, config, select, resolve } = args;
  const isBase = table === baseTableName(config.slug);
  const withParam: Dic = {};

  for (const reference of resolvedReferencesOf(config.fields)) {
    if (config._versions && reference.root !== isBase) continue;
    if (select?.length && !select.includes(reference.path)) continue;
    if (resolve && !resolve.includes(reference.path)) continue;

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
  /** See `resolvedReferenceJoins`. */
  resolve?: string[];
  locale?: string;
  /** The locales a read draws on, first to last — `localeOrder`. The requested one alone if absent. */
  fallback?: string[];
  tables: any;
  config: BuiltCollection | BuiltArea;
}) => {
  const { table, select = [], resolve, locale, fallback, tables, config: documentConfig } = args;
  // A child row — a block, a tree node — belongs to one locale. Its locales branch, and the
  // document's, are read for every locale in the order and merged in `transform`.
  const branchWhere = branchFilter(locale, fallback);
  if (!select.length) {
    return {
      ...buildFullWithParam({ table, locale, fallback, tables }),
      ...resolvedReferenceJoins({ table, tables, config: documentConfig, resolve })
    };
  }

  const withParam: Dic = resolvedReferenceJoins({
    table,
    tables,
    config: documentConfig,
    select,
    resolve
  });

  const directRelationPaths: string[] = [];
  /** The selected paths stored as child tables, by the tables' kind. */
  const childPaths: Record<NodeStorage['kind'], string[]> = { blocks: [], tree: [] };
  const allChildPaths = () => [...childPaths.blocks, ...childPaths.tree];

  /** The kinds of child table a field's branches are stored in — none for a column. */
  const storageKinds = (field: FormFieldBuilder) => [
    ...new Set(field.use.nodes().flatMap((node) => (node.storage ? [node.storage.kind] : [])))
  ];

  for (const path of select) {
    // Convert dot notation to double underscore notation for SQLite queries
    const sqlPath = path.replace(/\./g, '__');

    const fieldConfig = getFieldAtPath(path, documentConfig.fields);

    // Each branch is where the field's rows are stored: the junction table, a child table, or a
    // column of the row itself.
    if (fieldConfig instanceof RelationFieldBuilder) {
      directRelationPaths.push(path);
    } else if (fieldConfig && storageKinds(fieldConfig).length) {
      for (const kind of storageKinds(fieldConfig)) {
        childPaths[kind].push(path);
        for (const childTable of childTableNames(table, kind, tables)) {
          if (withParam[childTable]) continue;

          let params: Dic = { orderBy: { position: 'asc' } };
          const columns = getColumns(tables[childTable]);
          const hasLocale = Object.keys(columns).includes('locale');
          if (locale && hasLocale) {
            params = { ...params, where: { locale } };
          }
          withParam[childTable] = params;

          // Its locales branch with it.
          const localesTable = tableName({ owner: childTable, branch: 'locales' });
          if (locale && localesTable in tables) {
            withParam[childTable] = {
              ...withParam[childTable],
              with: { [localesTable]: { where: branchWhere } }
            };
          }
        }
      }
    } else if (fieldConfig) {
      if (fieldConfig.get.localized && locale) {
        const localesTableName = tableName({ owner: table, branch: 'locales' });
        if (localesTableName in tables) {
          // `locale` too: the merge picks each column by the locale its row is for.
          if (withParam[localesTableName]) {
            withParam[localesTableName].columns = {
              ...withParam[localesTableName].columns,
              [sqlPath]: true
            };
          } else {
            withParam[localesTableName] = {
              where: branchWhere,
              columns: { locale: true, [sqlPath]: true }
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
    allChildPaths().length > 0 &&
    tableName({ owner: table, child: { kind: 'rels' } }) in tables
  ) {
    // Create a where condition that matches relations within any of the container paths,
    // and include direct relation paths as exact matches.
    withParam[tableName({ owner: table, child: { kind: 'rels' } })] = {
      where: {
        OR: [
          // A container's rows sit under its path; a direct relation is the path itself.
          ...allChildPaths().map((path) => ({ path: { like: `${path}__%` } })),
          ...directRelationPaths.map((path) => ({ path }))
        ]
      },
      orderBy: { path: 'asc', position: 'asc' }
    };
  }

  // 2. Include tree tables for blocks that might contain trees
  if (childPaths.blocks.length > 0) {
    const treeTables = childTableNames(table, 'tree', tables);
    for (const treeTable of treeTables) {
      if (!withParam[treeTable]) {
        withParam[treeTable] = {
          where: { OR: childPaths.blocks.map((path) => ({ path: { like: `${path}__%` } })) },
          orderBy: { position: 'asc' }
        };

        // Handle localized trees
        const localesTreeTable = tableName({ owner: treeTable, branch: 'locales' });
        if (locale && localesTreeTable in tables) {
          withParam[treeTable] = {
            ...withParam[treeTable],
            with: {
              [localesTreeTable]: {
                where: branchWhere
              }
            }
          };
        }
      }
    }
  }

  // 3. Include block tables for trees that might contain blocks
  if (childPaths.tree.length > 0) {
    const blocksTables = childTableNames(table, 'blocks', tables);
    for (const blocksTable of blocksTables) {
      if (!withParam[blocksTable]) {
        withParam[blocksTable] = {
          where: { OR: childPaths.tree.map((path) => ({ path: { like: `${path}__%` } })) },
          orderBy: { position: 'asc' }
        };

        // Handle localized blocks
        const localesBlockTable = tableName({ owner: blocksTable, branch: 'locales' });
        if (locale && localesBlockTable in tables) {
          withParam[blocksTable] = {
            ...withParam[blocksTable],
            with: {
              [localesBlockTable]: {
                where: branchWhere
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

/** The filter on a locales branch: every locale in the fallback order, else the one requested. */
const branchFilter = (locale?: string, fallback?: string[]): Dic =>
  fallback && fallback.length > 1 ? { locale: { in: fallback } } : { locale };

const buildFullWithParam = ({
  table,
  locale,
  fallback,
  tables
}: {
  table: TableName;
  locale?: string;
  fallback?: string[];
  tables: Dic;
}): Dic => {
  const branchWhere = branchFilter(locale, fallback);
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
      withParam[localesTableName] = { where: branchWhere };
    }
    for (const blocksTable of blocksTables) {
      const localesBlockTable = tableName({ owner: blocksTable, branch: 'locales' });
      if (localesBlockTable in tables) {
        withParam[blocksTable] = {
          ...withParam[blocksTable],
          with: {
            [localesBlockTable]: {
              where: branchWhere
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
              where: branchWhere
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
