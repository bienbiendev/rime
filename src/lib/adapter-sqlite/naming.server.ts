import { withLocalesSuffix } from '$lib/core/i18n/naming.js';
import { toCamelCase, toPascalCase, toSnakeCase } from '$lib/util/string.js';

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
export const baseTableName = (slug: string): string => slug;

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

const CHILD_INFIX: Record<ChildKind, string> = {
  blocks: 'Blocks',
  tree: 'Tree',
  rels: 'Rels'
};

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
    name += CHILD_INFIX[parts.child.kind];
    if (parts.child.name) name += toPascalCase(parts.child.name);
  }

  return parts.branch === 'locales' ? withLocalesSuffix(name) : name;
};

/** The SQL table name for a Drizzle property name. */
export const toSqlTableName = (drizzleName: string) => toSnakeCase(drizzleName);

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
    (key) => key.startsWith(prefix) && !key.endsWith('Locales')
  );
};

/**
 * Generate the column and property names for a field given its name and its parent path.
 * Snake case is used for the sqlite column name and Camel case is used for the drizzle column
 * property name. The `__` separator is a path separator, never a word break, so it survives both
 * conversions.
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
