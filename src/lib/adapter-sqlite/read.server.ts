import type { BuiltArea, BuiltCollection } from '#lib/core/config/types.js';
import type { VersionsTable } from '#lib/core/adapter.js';
import { normalizeQuery } from '#lib/core/pipeline/query.js';
import type { OperationQuery } from '#lib/core/pipeline/types.js';
import type { PrototypeSlug, RawDoc } from '#lib/core/prototype/types.js';
import type { ConfigContext } from '#lib/core/rime.server.js';
import type { Dic } from '#lib/util/types.js';
import { and, eq, inArray } from 'drizzle-orm';
import { RimeError } from '../core/errors/index.js';
import type { GenericTable } from './types.server.js';
import { baseTableName } from './naming.server.js';
import { buildOrderByParam } from './order-by.server.js';
import * as adapterUtil from './columns.server.js';
import { buildWhereParam } from './where.server.js';
import { localeOrder } from './locales.server.js';
import { buildWithParam, pathsJoin, resolvedReferenceJoins } from './select.server.js';

/**
 * Reading a prototype's rows.
 *
 * The adapter's vocabulary is in `naming.server.ts`: **base**, **versions** (a second table
 * holding the content), **child** (blocks, tree, the relations junction) and **branch** (the
 * localized half). "Collection" and "area" are not adapter words: the one difference between
 * them is who supplies the root row's id. Writing is `write.server.ts` beside this.
 */

type ReadArgs = {
  slug: string;
  /** Where the content lives, when not on the base row — `config._versions`. */
  versions?: VersionsTable;
  /** Restrict to one root row. Omitted for a singleton, which has exactly one. */
  id?: string;
  select?: string[];
  locale?: string;
  /** Whether an untranslated field reads from the other locales. `true` unless said otherwise. */
  localeFallback?: boolean;
  /**
   * The resolved references to join, by document path — a `$references(slug, { resolve: true })`
   * field comes back as the document it points at only when its path is here. Every one when
   * absent; `select` narrows further. The caller lists what its reader may see, so a row is never
   * joined for a field the pipeline goes on to drop.
   */
  resolve?: string[];
  /** Which content row, when the caller means a particular one. The newest otherwise. */
  content?: OperationQuery;
  config: BuiltCollection | BuiltArea;
};

/**
 * Reads one prototype document, merged with the content row it should show.
 *
 * Returns `undefined` when there is nothing to read rather than throwing, and the caller decides
 * what that means — for most callers a 404.
 *
 * It does **not** mean "this prototype has never been written": `undefined` also covers a row
 * that exists with no content row matching the caller's filter. Bootstrapping on it would
 * write a second singleton row. `ensurePrototypeExists` asks the root table directly, which is
 * the only question that actually means "absent".
 *
 * The one structural difference between reading a singleton and reading one of many is the
 * `where` on the root row — supply `id`, or don't.
 */
export const readPrototype = async (
  { db, tables, configCtx }: DepsWithConfig,
  { slug, id, select, resolve, locale, localeFallback, content, config, versions }: ReadArgs
): Promise<Dic | undefined> => {
  const table = baseTableName(slug);
  const rootTable = tables[table];
  const fallback = localeOrder(configCtx, locale, localeFallback);
  // Cast because with a single registered area the slug type collapses to one literal and
  // Drizzle infers an over-precise per-table shape instead of the general one.
  const queryTable = (db.query as Record<string, any>)[table];
  const byId = id ? { where: { RAW: (t: GenericTable) => eq(t.id, id) } } : {};

  // No versions: the content is on the base row and there is nothing to merge.
  if (!versions) {
    return queryTable.findFirst({
      columns: adapterUtil.columnsParams({ table: rootTable, select }),
      ...byId,
      with:
        buildWithParam({ table, select, resolve, locale, fallback, tables, config }) || undefined
    });
  }

  // See findManyPrototypes for why the versions table's slug is castable.
  const versionsSlug = versions.slug as PrototypeSlug;
  const contentTable = baseTableName(versionsSlug);

  const doc = await queryTable.findFirst({
    columns: adapterUtil.columnsParams({ table: rootTable, select }),
    ...byId,
    with: {
      // The base row's own resolved references and address; the content row's come with
      // `buildWithParam`.
      ...resolvedReferenceJoins({ table, tables, config, select, resolve }),
      ...pathsJoin({ base: table, tables, locale, select }),
      [contentTable]: {
        columns: adapterUtil.columnsParams({ table: tables[contentTable], select }),
        with: buildWithParam({
          table: contentTable,
          select,
          resolve,
          locale,
          fallback,
          tables,
          config
        }),
        // The row the caller's filter names, else the newest — one query either way, and the
        // adapter chooses nothing. Which content row a request means is decided above this module
        // and arrives as an ordinary filter (`versionsReadQuery`).
        //
        // The `orderBy`/`limit` are what "the content of this document" means with nothing else
        // said, the same statement as `updatedAt` being the default sort. A filter narrows within
        // that, it does not replace it.
        ...(content
          ? {
              where: {
                RAW: (t: GenericTable) =>
                  buildWhereParam({
                    query: normalizeQuery(content),
                    slug: versionsSlug,
                    base: slug as PrototypeSlug,
                    locale,
                    db,
                    configCtx,
                    tables,
                    rootTable: t
                  })
              }
            }
          : {}),
        orderBy: { updatedAt: 'desc' },
        limit: 1
      }
    }
  });

  // A base row with no content row is as good as absent — there is nothing to show.
  if (!doc || !doc[contentTable] || doc[contentTable].length === 0) return undefined;

  return adapterUtil.mergeContentRow(doc, contentTable, config, select);
};

/**
 * Reads many documents, merged with the content row each should show.
 *
 * The versioned branch queries the base table and pulls one content row per document, because
 * pagination and ordering are properties of the document rather than of one of its rows.
 */
export const findManyPrototypes = async (
  { db, tables, configCtx }: DepsWithConfig,
  args: FindManyArgs
): Promise<RawDoc[]> => {
  const {
    select,
    resolve,
    query: incomingQuery,
    sort,
    limit,
    offset,
    locale,
    localeFallback,
    content,
    config,
    versions
  } = args;
  // buildOrderByParam and buildWhereParam resolve fields against the config, so they take a
  // prototype slug. Registration guarantees this one is registered, hence is one.
  const slug = args.slug as PrototypeSlug;
  const table = baseTableName(slug);
  const query = incomingQuery ? normalizeQuery(incomingQuery) : undefined;
  const fallback = localeOrder(configCtx, locale, localeFallback);

  // No versions: everything is on the base table, so this is one plain query.
  if (!versions) {
    const params: Dic = {
      with:
        buildWithParam({ table, select, resolve, tables, config, locale, fallback }) || undefined,
      orderBy: (t: GenericTable) =>
        buildOrderByParam({ slug, locale, tables, configCtx, by: sort, rootTable: t }),
      ...pageParams(limit, offset)
    };

    if (query) {
      params.where = {
        RAW: (t: GenericTable) =>
          buildWhereParam({ query, slug, locale, db, configCtx, tables, rootTable: t })
      };
    }

    Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

    return await (db.query as Record<string, any>)[table].findMany({
      columns: adapterUtil.columnsParams({ table: tables[table], select }),
      ...params
    });
  }

  // buildWithParam reads the schema, so it takes a table name; buildWhereParam resolves fields
  // against the config, so it takes a slug.
  // `VersionsTable.slug` is a plain string on purpose — a feature names a slug, and only the
  // registry knows which slugs exist. The cast is the same one `slug` above takes, and sound for
  // the same reason: a versions table is a registered prototype in its own right (the feature that
  // declares one also derives its config), so `buildWhereParam` can resolve fields against it.
  const versionsSlug = versions.slug as PrototypeSlug;
  const contentTable = baseTableName(versionsSlug);
  const withParam =
    buildWithParam({ table: contentTable, select, resolve, tables, config, locale, fallback }) ||
    undefined;

  // The caller's own filter, and the one saying which content row each document shows. Both
  // resolve against the versions table, so they are two wheres to `and`.
  const contentWhere = (rootTable: GenericTable) => {
    const wheres = [query, content && normalizeQuery(content)]
      .filter((one) => !!one)
      .map((one) =>
        buildWhereParam({
          query: one,
          slug: versionsSlug,
          base: slug,
          locale,
          db,
          configCtx,
          tables,
          rootTable
        })
      )
      // Only `undefined` drops out: `buildWhereParam` answers `false` for a degenerate query (an
      // empty `and`/`or`), which goes to drizzle as is.
      .filter((one) => one !== undefined);

    return wheres.length > 1 ? and(...wheres) : wheres[0];
  };

  const params: Dic = {
    ...pageParams(limit, offset),
    // The sortable columns are on the versions table, so the sort builder is handed it by name.
    orderBy: (t: GenericTable) =>
      buildOrderByParam({
        slug,
        locale,
        tables,
        configCtx,
        by: sort,
        versions: contentTable,
        contentWhere,
        rootTable: t
      })
  };

  // Only the documents that have a matching content row, before `limit` and `offset` cut the page.
  // The same `contentWhere` as the join below, run on the versions table itself.
  if (query || content) {
    const contentRows = tables[contentTable];
    params.where = {
      RAW: (t: GenericTable) =>
        inArray(
          t.id,
          db.select({ id: contentRows.ownerId }).from(contentRows).where(contentWhere(contentRows))
        )
    };
  }
  Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

  const rawDocs = await (db.query as Record<string, any>)[table].findMany({
    ...params,
    columns: adapterUtil.columnsParams({ table: tables[table], select }),
    with: {
      ...resolvedReferenceJoins({ table, tables, config, select, resolve }),
      ...pathsJoin({ base: table, tables, locale, select }),
      [contentTable]: {
        with: withParam,
        where: { RAW: contentWhere },
        orderBy: { updatedAt: 'desc' },
        limit: 1,
        columns: adapterUtil.columnsParams({ table: tables[contentTable], select })
      }
    }
  });

  return rawDocs
    .map((doc: RawDoc) => {
      try {
        return adapterUtil.mergeContentRow(doc, contentTable, config, select);
      } catch (err: any) {
        // A document left with no content row drops out of the result rather than failing the
        // whole read. The `where` above keeps such a document off the page in the first place.
        if (err instanceof RimeError && err.code === RimeError.NOT_FOUND) return false;
        throw err;
      }
    })
    .filter(Boolean);
};

/**
 * `limit` and `offset` as SQLite takes them: an offset that is not a positive integer is none,
 * and SQLite needs a limit beside an offset.
 */
const pageParams = (limit?: number, offset?: number) => {
  const skip = Number.isInteger(offset) && offset! > 0 ? offset : undefined;
  return { limit: limit || (skip ? 1000000 : undefined), offset: skip };
};

type FindManyArgs = {
  versions?: VersionsTable;
  slug: string;
  select?: string[];
  query?: OperationQuery;
  sort?: string;
  limit?: number;
  offset?: number;
  locale?: string;
  /** See `readPrototype`. */
  localeFallback?: boolean;
  /** See `readPrototype`. */
  resolve?: string[];
  /** Per document, which content row — see `readPrototype`. */
  content?: OperationQuery;
  config: BuiltCollection | BuiltArea;
};

/**
 * The reads reach buildOrderByParam and buildWhereParam, which are typed against the generated
 * schema rather than against `Dic`, so `db` and `tables` stay `any` here.
 */
type DepsWithConfig = { db: any; tables: any; configCtx: ConfigContext };
