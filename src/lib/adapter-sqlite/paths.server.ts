import type { PathRow, PathsHandle } from '$lib/core/adapter.js';
import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import { and, eq, gt, isNull, lt, notInArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { baseTableName, tableName } from './naming.server.js';
import type { AdapterDeps, GenericTable } from './types.server.js';

/**
 * The addresses of a collection's pages, in its `__$paths` table.
 *
 * Every statement names one page. The pages under it follow through the foreign key on
 * `(locale, parent_path)`: SQLite rewrites their `parent_path`, which regenerates their `path`.
 */
const createPathsHandle = ({ db, tables }: AdapterDeps): PathsHandle => {
  const tablesOf = (slug: PrototypeSlug) => {
    const base = baseTableName(slug);
    return {
      base: tables[base] as GenericTable,
      paths: tables[tableName({ owner: base, child: { kind: 'paths' } })] as GenericTable
    };
  };

  /** The parent's path in `locale`: a subquery, so the write stays one statement. */
  const parentPathIn = (paths: GenericTable, parentId: string, locale: unknown) => {
    const parent = alias(paths, 'parent');
    return sql`(${db
      .select({ path: parent.path })
      .from(parent)
      .where(and(eq(parent.ownerId, parentId), sql`${parent.locale} = ${locale}`))})`;
  };

  const rowsOf = (rows: unknown[]) => rows as PathRow[];

  return {
    insert: async ({ slug, ownerId, parentId, rows }) => {
      if (!rows.length) return [];
      const { paths } = tablesOf(slug);
      const inserted = await db
        .insert(paths)
        .values(
          rows.map((row) => ({
            ownerId,
            locale: row.locale,
            slug: row.slug,
            parentPath: parentId ? parentPathIn(paths, parentId, row.locale) : null
          }))
        )
        .returning();
      return rowsOf(inserted);
    },

    get: async ({ slug, ownerId, locale }) => {
      const { paths } = tablesOf(slug);
      const where =
        locale === undefined
          ? eq(paths.ownerId, ownerId)
          : and(eq(paths.ownerId, ownerId), eq(paths.locale, locale));
      return rowsOf(await db.select().from(paths).where(where));
    },

    setSlug: async ({ slug, ownerId, locale, value }) => {
      const { paths } = tablesOf(slug);
      const [row] = await db
        .update(paths)
        .set({ slug: value })
        .where(and(eq(paths.ownerId, ownerId), eq(paths.locale, locale)))
        .returning();
      return row as PathRow | undefined;
    },

    // One statement per locale, in one transaction: each row takes its new parent's path in its
    // locale, and its slug there.
    moveUnder: async ({ slug, ownerId, parentId, slugs }) => {
      const { paths } = tablesOf(slug);
      return db.transaction(async (tx) => {
        const moved: unknown[] = [];
        for (const [locale, value] of Object.entries(slugs)) {
          const rows = await tx
            .update(paths)
            .set({
              slug: value,
              parentPath: parentId ? parentPathIn(paths, parentId, locale) : null
            })
            .where(and(eq(paths.ownerId, ownerId), eq(paths.locale, locale)))
            .returning();
          moved.push(...rows);
        }
        return rowsOf(moved);
      });
    },

    children: async ({ slug, ownerId }) => {
      const { paths } = tablesOf(slug);
      const self = alias(paths, 'self');
      const rows = await db
        .selectDistinct({ ownerId: paths.ownerId })
        .from(paths)
        .where(
          sql`(${paths.locale}, ${paths.parentPath}) IN (${db
            .select({ locale: self.locale, path: self.path })
            .from(self)
            .where(eq(self.ownerId, ownerId))})`
        );
      return rows.map((row) => row.ownerId as string);
    },

    // `path/` <= p < `path0` is every path starting with `path/`, read off the unique index:
    // '0' is the character after '/'.
    under: async ({ slug, locale, path, withDescendants = true }) => {
      const { paths } = tablesOf(slug);
      const below = and(gt(paths.path, `${path}/`), lt(paths.path, `${path}0`));
      const where = and(
        eq(paths.locale, locale),
        withDescendants ? or(eq(paths.path, path), below) : eq(paths.path, path)
      );
      return rowsOf(await db.select().from(paths).where(where));
    },

    siblingSlugs: async ({ slug, locale, parentId }) => {
      const { paths } = tablesOf(slug);
      const parent = parentId
        ? sql`${paths.parentPath} = ${parentPathIn(paths, parentId, locale)}`
        : isNull(paths.parentPath);
      const rows = await db
        .select({ slug: paths.slug })
        .from(paths)
        .where(and(eq(paths.locale, locale), parent));
      return rows.map((row) => row.slug as string);
    },

    missingOwners: async ({ slug, locale }) => {
      const { base, paths } = tablesOf(slug);
      const owned = db.select({ id: paths.ownerId }).from(paths).where(eq(paths.locale, locale));
      const rows = await db.select({ id: base.id }).from(base).where(notInArray(base.id, owned));
      return rows.map((row) => row.id as string);
    },

    setUrls: async ({ slug, rows }) => {
      if (!rows.length) return;
      const { paths } = tablesOf(slug);
      await db.transaction(async (tx) => {
        for (const { ownerId, locale, url } of rows) {
          await tx
            .update(paths)
            .set({ url })
            .where(and(eq(paths.ownerId, ownerId), eq(paths.locale, locale)));
        }
      });
    }
  };
};

export default createPathsHandle;
