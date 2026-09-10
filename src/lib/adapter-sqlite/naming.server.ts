import { mapSegments, toCamelCase, toSnakeCase } from '$lib/util/string.js';

/**
 * How a table is named, in one place. Names are built from parts, never concatenated at the call
 * site.
 *
 * Four words, and every table in a generated schema is one of them:
 *
 * ```
 * base      pages                                a prototype's own rows
 * versions  pages__versions                      the second table its content lives in
 * child     pages__$relations                    hangs off an owner by `ownerId`
 *           pages__$blocks_hero                  one per block type
 *           pages__$tree_facts                   one per tree field
 * branch    pages__$blocks_hero__$$locales       the localized half of whatever it hangs off
 * ```
 *
 * `owner` is the base or the versions table, resolved before a name is wanted — which is what
 * moves a config's whole subtree of children onto the second table when it gains versions:
 *
 * ```ts
 * tableName({ owner: baseTableName('pages') })
 * // 'pages'
 *
 * tableName({ owner: baseTableName('$pages__versions'), child: { kind: 'blocks', name: 'hero' } })
 * // 'pages__versions__$blocks_hero'
 *
 * tableName({ owner: baseTableName('pages'), child: { kind: 'rels' }, branch: 'locales' })
 * // 'pages__$relations__$$locales'
 * ```
 *
 * A slug and a table name are both strings and are not interchangeable — `$a__b` lives in `a__b`,
 * `camelProbe` in `camel_probe`. `TableName` is branded so the compiler catches the mix-up.
 */

declare const TABLE_NAME_BRAND: unique symbol;

/**
 * A resolved table name, as opposed to a prototype slug.
 *
 * A slug reaching a table-name parameter would look up `undefined` in the generated schema and
 * fail at the request. The brand makes it a build error instead.
 */
export type TableName = string & { readonly [TABLE_NAME_BRAND]: true };

/**
 * The table a prototype's own rows live in: `$a__b` -> `a__b`, `camelProbe` -> `camel_probe`.
 * The only way to turn a slug into a table name.
 */
export const baseTableName = (slug: string): TableName =>
  mapSegments(slug.replace(/^\$/, ''), toSnakeCase, '__') as TableName;

/**
 * The name a declared table is exported under, minus the `$` marking it derived.
 *
 * ```
 * $someTable   ->  exported as `someTable`, lives in `some_table`
 * ```
 *
 * The reverse of a prototype's table, where the slug is authored and the SQL name derived from it.
 * Here the identifier is fixed — whoever declared the table reaches its rows by that name — and
 * the SQL name is derived.
 */
export const declaredTableProperty = (slug: string): TableName =>
  slug.replace(/^\$/, '') as TableName;

export type ChildKind = 'blocks' | 'tree' | 'rels';

export type TableParts = {
  /**
   * The base or versions table this hangs off, already resolved.
   *
   * Everything below is named relative to it, which is what makes a config gaining a versions table move
   * a whole subtree of children onto it.
   */
  owner: TableName;
  /** A child table. `name` is the block type or the tree field; `rels` has no name. */
  child?: { kind: ChildKind; name?: string };
  /** The localized half of whatever the parts above resolve to. */
  branch?: 'locales';
};

/**
 * `__$` marks a child of the owner it is appended to; `rels` needs no name because a prototype
 * has exactly one relations junction, discriminated by its `path` column rather than by table.
 */
const CHILD_MARKER: Record<ChildKind, string> = {
  blocks: '__$blocks',
  tree: '__$tree',
  rels: '__$relations'
};

/** `__$$` marks a branch: the half of a table holding its localized columns. */
const BRANCH_MARKER = '__$$locales';

/**
 * Assembles a Drizzle property name from its parts.
 *
 * @example
 * tableName({ owner: pages })                                   // 'pages'
 * tableName({ owner: pagesShadow, branch: 'locales' })          // 'pages__shadow__$$locales'
 * tableName({ owner: pages, child: { kind: 'blocks', name: 'hero' }}) // 'pages__$blocks_hero'
 * tableName({ owner: pages, child: { kind: 'rels' } })          // 'pages__$relations'
 */
export const tableName = (parts: TableParts): TableName => {
  let name: string = parts.owner;

  if (parts.child) {
    name += CHILD_MARKER[parts.child.kind];
    if (parts.child.name) name += `_${toSnakeCase(parts.child.name)}`;
  }

  return (parts.branch === 'locales' ? `${name}${BRANCH_MARKER}` : name) as TableName;
};

/**
 * The SQL table name for a Drizzle property name.
 *
 * Identity: property names are already snake-cased with their markers intact, so the two forms
 * are the same string. Snake-casing a camelCase property name instead produces an unreadable mix
 * (`pages_shadowBlocksHero` -> `pages_shadow_blocks_hero`), where nothing says which
 * underscore means what.
 */
export const toSqlTableName = (drizzleName: TableName) => drizzleName;

/**
 * Every child table of `owner` of a given kind, read back off the schema.
 *
 * Excludes the `locales` branches, which are reached through their own owner rather than listed
 * alongside it. Replaces the three hand-written filters, one of which was misnamed.
 */
export const childTableNames = (
  owner: TableName,
  kind: ChildKind,
  tables: Record<string, unknown>
): TableName[] => {
  const prefix = tableName({ owner, child: { kind } });
  // Keys of the generated schema: table names by construction.
  return Object.keys(tables).filter(
    (key) => key.startsWith(prefix) && !key.endsWith(BRANCH_MARKER)
  ) as TableName[];
};

/**
 * Generate the column and property names for a field given its name and its parent path.
 * Snake case is used for the sqlite column name and Camel case is used for the drizzle column
 * property name.
 *
 * A nested field path uses the same `__` segment separator as a slug, and for the same reason: it
 * must survive case conversion as a boundary rather than collapse into a word break. Hence
 * `mapSegments`, shared with slug naming.
 *
 * @example
 * // returns { camel : 'groupTitle', snake: 'group__title' }
 * getSchemaColumnNames({ name: 'title', parentPath: 'group' })
 */
export function getSchemaColumnNames(args: { name: string; parentPath?: string }) {
  const name = args.parentPath ? `${args.parentPath}__${args.name}` : args.name;

  return {
    camel: mapSegments(name, toCamelCase, '__'),
    snake: mapSegments(name, toSnakeCase, '__')
  };
}
