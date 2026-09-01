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
 * This module deliberately still emits the *current* names. Consolidating where the convention
 * lives and changing what it produces are separate steps; the generated schema is byte-identical
 * to before it existed.
 */

/**
 * The table a prototype's own rows live in.
 *
 * Identity today, and that is exactly why it needs to exist: a prototype **slug** and a **table
 * name** are currently the same string, so nothing in the adapter distinguishes
 * `tables[slug]` — "the table for this collection" — from `tables[versionsTable]` — "the table
 * I just computed a name for". They are different questions, and the moment the naming
 * convention changes they stop having the same answer: the collection `pages_versions` will
 * live in the table `pages__versions`.
 *
 * Routing every slug-keyed lookup through here is what makes that change one edit rather than
 * an audit of ninety-seven call sites. Sites that already hold a *table name* must not call
 * this — they are already resolved.
 */
export const baseTableName = (slug: string): string =>
  mapSegments(slug.replace(/^\$/, ''), toSnakeCase, '__');

export type ChildKind = 'blocks' | 'tree' | 'rels';

export type TableParts = {
  /**
   * The base or shadow table this hangs off, already resolved — `pages` or `pages_versions`.
   * Everything below is named relative to it, which is what makes enabling versions rename a
   * whole subtree.
   */
  owner: string;
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
 * tableName({ owner: 'pages' })                                        // 'pages'
 * tableName({ owner: 'pages_versions', branch: 'locales' })            // 'pages_versionsLocales'
 * tableName({ owner: 'pages', child: { kind: 'blocks', name: 'hero' }})// 'pagesBlocksHero'
 * tableName({ owner: 'pages', child: { kind: 'rels' } })               // 'pagesRels'
 */
export const tableName = (parts: TableParts): string => {
  let name = parts.owner;

  if (parts.child) {
    name += CHILD_MARKER[parts.child.kind];
    if (parts.child.name) name += `_${toSnakeCase(parts.child.name)}`;
  }

  return parts.branch === 'locales' ? `${name}${BRANCH_MARKER}` : name;
};

/**
 * The SQL table name for a Drizzle property name.
 *
 * Identity: property names are already snake-cased with their markers intact, so the two forms
 * are the same string. It used to snake-case a camelCase property name, which is what produced
 * the unreadable mix (`pages_versionsBlocksHero` -> `pages_versions_blocks_hero`, where nothing
 * says which underscore means what).
 */
export const toSqlTableName = (drizzleName: string) => drizzleName;

/**
 * Every child table of `owner` of a given kind, read back off the schema.
 *
 * Excludes the `locales` branches, which are reached through their own owner rather than listed
 * alongside it. Replaces the three hand-written filters, one of which was misnamed.
 */
export const childTableNames = (
  owner: string,
  kind: ChildKind,
  tables: Record<string, unknown>
): string[] => {
  const prefix = tableName({ owner, child: { kind } });
  return Object.keys(tables).filter(
    (key) => key.startsWith(prefix) && !key.endsWith(BRANCH_MARKER)
  );
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
