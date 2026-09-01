import { mapSegments, toCamelCase, toSnakeCase } from '$lib/util/string.js';

/**
 * How a table is named, in one place.
 *
 * Before this module the convention was written out wherever a name was needed: `Blocks<Name>`
 * four times, `Tree<Name>` four times, `` `${slug}Rels` `` thirteen times, and three copies of a
 * "list the child tables of X" filter — one of which, in tree.server.ts, was a copy of the blocks
 * version still called `getBlocksTableNames`. Nothing compared those copies, so the convention
 * could drift silently between codegen and runtime.
 *
 * Names are built from **parts**, not by concatenation at the call site. That is the point: the
 * assembly rule lives here, so changing it is one edit rather than twenty-one.
 *
 * The vocabulary follows docs/decoupling-adapter.md:
 *
 * - **base**   — a prototype's own table (`pages`)
 * - **shadow** — a table that stands in for the base (`pages_versions`, from the versions
 *                feature). Callers pass an already-resolved `owner`, because which of base or
 *                shadow owns a subtree is a versions decision, made before a name is needed.
 * - **child**  — hangs off an owner by `ownerId`: blocks, tree, and the relations junction
 * - **branch** — splits an owner in two: the localized half
 *
 * A `TableName` is branded so it cannot be confused with a prototype slug — see the type below.
 */

declare const TABLE_NAME_BRAND: unique symbol;

/**
 * A resolved table name, as opposed to a prototype slug.
 *
 * Both are strings, which is why the two got confused for as long as they happened to be the
 * same string. Since the naming convention changed they are not — the collection `$pages__versions`
 * lives in the table `pages__versions`, and `camelProbe` in `camel_probe` — and passing one where
 * the other is wanted produces `undefined` at the schema lookup, never a type error.
 *
 * That cost four separate sweeps to chase down (`tables[…]`, `getTable(…)`, `db.query[…]`, then
 * the table-name *parameters* of insertTableRecord/updateTableRecord/prepareSchemaData), each
 * found by a failing request rather than by the compiler. The brand ends that: a plain string
 * no longer satisfies a table-name parameter, so the remaining cases surface at build time.
 */
export type TableName = string & { readonly [TABLE_NAME_BRAND]: true };

/** For the few places holding a name that genuinely came from the schema, not from a slug. */
export const asTableName = (name: string) => name as TableName;

/**
 * The table a prototype's own rows live in: `$pages__versions` -> `pages__versions`,
 * `camelProbe` -> `camel_probe`. The only way to turn a slug into a table name.
 */
export const baseTableName = (slug: string): TableName =>
  mapSegments(slug.replace(/^\$/, ''), toSnakeCase, '__') as TableName;

export type ChildKind = 'blocks' | 'tree' | 'rels';

export type TableParts = {
  /**
   * The base or shadow table this hangs off, already resolved — `pages` or `pages_versions`.
   * Everything below is named relative to it, which is what makes enabling versions rename a
   * whole subtree.
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
 * tableName({ owner: pagesVersions, branch: 'locales' })        // 'pages__versions__$$locales'
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
 * are the same string. It used to snake-case a camelCase property name, which is what produced
 * the unreadable mix (`pages_versionsBlocksHero` -> `pages_versions_blocks_hero`, where nothing
 * says which underscore means what).
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
 * A nested field path uses the same `__` segment separator as a slug, and for the same reason —
 * it must survive case conversion as a boundary rather than collapse into a word break. This
 * used to hand-roll the split/rejoin; it shares mapSegments with slug naming now.
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
