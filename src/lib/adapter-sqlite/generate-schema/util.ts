import { toCamelCase, toPascalCase, toSnakeCase } from '$lib/util/string.js';

/**
 * Gets all tree table names for a specific collection in the database schema.
 * Tree tables store hierarchical document relationships.
 *
 * @example
 * // Returns ['pagesTreeBaz', 'pagesTreeFoo']
 * getTreeTableNames('pages', dbSchema.tables);
 */
export const getTreeTableNames = (slug: string, tables: Record<string, any>): string[] =>
  Object.keys(tables).filter((key) => key.startsWith(`${slug}Tree`) && !key.endsWith('Locales'));

/**
 * Make a Tree table name given a root table slug and the Tree field name
 *
 * @example
 * // Returns 'pagesTreeBaz'
 * makeTreeTableSlug('pages', 'baz')
 */
export const makeTreeTableSlug = (slug: string, fieldName: string): string =>
  `${slug}Tree${toPascalCase(fieldName)}`;

/**
 * Gets all blocks table names for a specific collection in the database schema.
 * Blocks tables store flexible content blocks data.
 *
 * @example
 * // Returns ['pagesBlocks', 'pagesBlocksContent']
 * getBlocksTableNames('pages', dbSchema.tables);
 */
export const getBlocksTableNames = (slug: string, tables: Record<string, any>): string[] =>
  Object.keys(tables).filter((key) => key.startsWith(`${slug}Blocks`) && !key.endsWith('Locales'));

/**
 * Make a Block table name given a root table slug and the block.type
 *
 * @example
 * // Returns 'pagesBlocksBaz'
 * makeBlockTableSlug('pages', 'baz')
 */
export const makeBlockTableSlug = (slug: string, blockType: string): string =>
  `${slug}Blocks${toPascalCase(blockType)}`;

/**
 * Generate the column's names for a given field name and its parent path
 * Snake case is used for sqlite column name and Camel case is user for the drizzle column property name
 *
 * @example
 * // returns { camel : 'groupTitle', snake: 'group__title' }
 * getSchemaColumnNames({ name: 'title', parentPath: 'group' })
 */
export function getSchemaColumnNames(args: { name: string; parentPath?: string }) {
  const name = args.parentPath ? `${args.parentPath}__${args.name}` : args.name;

  // Preserve leading underscore if present
  const hasLeadingUnderscore = name.startsWith('_');
  const processedName = hasLeadingUnderscore ? name.slice(1) : name;

  const processParts = (parts: string[], formatter: (s: string) => string) => {
    const processed = parts.map((part) => formatter(part)).join('__');
    return hasLeadingUnderscore ? `_${processed}` : processed;
  };

  const parts = processedName.split('__');

  return {
    camel: processParts(parts, toCamelCase),
    snake: processParts(parts, toSnakeCase)
  };
}
