import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { VersionsTable } from '$lib/core/adapter.js';
import { normalizeQuery } from '$lib/core/pipeline/query.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { PrototypeSlug, RawDoc } from '$lib/core/prototype/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';
import { and, desc, eq } from 'drizzle-orm';
import { RimeError } from '../core/errors/index.js';
import { baseTableName } from './naming.server.js';
import { buildOrderByParam } from './order-by.server.js';
import * as adapterUtil from './columns.server.js';
import { buildWhereParam } from './where.server.js';
import { buildWithParam } from './select.server.js';

/**
 * Reading a prototype's rows.
 *
 * The adapter's vocabulary is docs/decoupling.md appendix A: **base**, **versions** (a second table
 * holding the content), **child** (blocks, tree, the relations junction) and **branch** (the
 * localized half). "Collection" and "area" are not adapter words. They were, in the two facades
 * this replaces, and that was the mistake: a whole parallel implementation existed because the
 * database layer thought the kinds were different things. Diffed, every difference reduced to
 * one — who supplies the root row's id.
 *
 * `singleton` is the one shape fact this side needs: it decides whether a read wants an id.
 * Writing is `write.server.ts` beside this. One 649-line file held both, and the two halves share
 * nothing but their imports.
 */

type ReadArgs = {
  slug: string;
  /** Where the content lives, when not on the base row — see `RegisterPrototypeArgs.versions`. */
  versions?: VersionsTable;
  /** Restrict to one root row. Omitted for a singleton, which has exactly one. */
  id?: string;
  select?: string[];
  locale?: string;
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
  { slug, id, select, locale, content, config, versions }: ReadArgs
): Promise<Dic | undefined> => {
  const table = baseTableName(slug);
  const rootTable = tables[table];
  // Cast because with a single registered area the slug type collapses to one literal and
  // Drizzle infers an over-precise per-table shape instead of the general one.
  const queryTable = (db.query as Record<string, any>)[table];
  const byId = id ? { where: eq(rootTable.id, id) } : {};

  // No versions: the content is on the base row and there is nothing to merge.
  if (!versions) {
    return queryTable.findFirst({
      columns: adapterUtil.columnsParams({ table: rootTable, select }),
      ...byId,
      with: buildWithParam({ table, select, locale, tables, config }) || undefined
    });
  }

  // See findManyPrototypes for why the versions's slug is castable.
  const versionsSlug = versions.slug as PrototypeSlug;
  const contentTable = baseTableName(versionsSlug);

  const doc = await queryTable.findFirst({
    columns: adapterUtil.columnsParams({ table: rootTable, select }),
    ...byId,
    with: {
      [contentTable]: {
        columns: adapterUtil.columnsParams({ table: tables[contentTable], select }),
        with: buildWithParam({ table: contentTable, select, locale, tables, config }),
        // The row the caller's filter names, else the newest — one query either way, and the
        // adapter chooses nothing. Which content row a request means is decided above this module
        // and arrives as an ordinary filter (`FeatureDefinition.readQuery`).
        //
        // The `orderBy`/`limit` are not the third branch coming back: they are what "the content
        // of this document" means with nothing else said, the same statement as `updatedAt` being
        // the default sort. A filter narrows within that, it does not replace it.
        ...(content
          ? {
              where: buildWhereParam({
                query: normalizeQuery(content),
                slug: versionsSlug,
                base: slug as PrototypeSlug,
                locale,
                db,
                configCtx,
                tables
              })
            }
          : {}),
        orderBy: [desc(tables[contentTable].updatedAt)],
        limit: 1
      }
    }
  });

  // A base row with no content row is as good as absent — there is nothing to show.
  if (!doc || !doc[contentTable] || doc[contentTable].length === 0) return undefined;

  return adapterUtil.mergeContentRow(doc, contentTable, config, select);
};

export const findManyPrototypes = async (
  { db, tables, configCtx }: DepsWithConfig,
  args: FindManyArgs
): Promise<RawDoc[]> => {
  const {
    select,
    query: incomingQuery,
    sort,
    limit,
    offset,
    locale,
    content,
    config,
    versions
  } = args;
  // buildOrderByParam and buildWhereParam resolve fields against the config, so they take a
  // prototype slug. Registration guarantees this one is registered, hence is one.
  const slug = args.slug as PrototypeSlug;
  const table = baseTableName(slug);
  const query = incomingQuery ? normalizeQuery(incomingQuery) : undefined;

  // No versions: everything is on the base table, so this is one plain query.
  if (!versions) {
    const params: Dic = {
      with: buildWithParam({ table, select, tables, config, locale }) || undefined,
      orderBy: buildOrderByParam({ slug, locale, tables, by: sort }),
      // sqlite requires a limit when an offset is present.
      limit: limit || (typeof offset === 'number' ? 1000000 : undefined),
      offset: offset || undefined
    };

    if (query) {
      params.where = buildWhereParam({ query, slug, locale, db, configCtx, tables });
    }

    Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

    return await (db.query as Record<string, any>)[table].findMany({
      columns: adapterUtil.columnsParams({ table: tables[table], select }),
      ...params
    });
  }

  // Two different things that stopped being the same string when the naming convention changed:
  // buildWithParam reads the schema, so it takes a table name; buildWhereParam resolves fields
  // against the config, so it takes a slug.
  // `VersionsTable.slug` is a plain string on purpose — a feature names a slug, and only the
  // registry knows which slugs exist. The cast is the same one `slug` above takes, and sound for
  // the same reason: a versions is a registered prototype in its own right (the feature that
  // declares one also derives its config), so `buildWhereParam` can resolve fields against it.
  const versionsSlug = versions.slug as PrototypeSlug;
  const contentTable = baseTableName(versionsSlug);
  const withParam =
    buildWithParam({ table: contentTable, select, tables, config, locale }) || undefined;

  // The caller's own filter, and the one saying which content row each document shows. Both
  // resolve against the versions, so they are two wheres to `and` rather than two query objects to
  // splice — which is what this was, a condition spliced into somebody else's `where` by hand
  // behind a config read.
  const wheres = [query, content && normalizeQuery(content)]
    .filter((one) => !!one)
    .map((one) =>
      buildWhereParam({ query: one, slug: versionsSlug, base: slug, locale, db, configCtx, tables })
    )
    // Only `undefined` drops out. `buildWhereParam` answers `false` for a degenerate query (an
    // empty `and`/`or`), and that was passed straight to drizzle before; it still is.
    .filter((one) => one !== undefined);

  const whereParam = wheres.length > 1 ? and(...wheres) : wheres[0];

  const params: Dic = {
    limit: limit || (typeof offset === 'number' ? 1000000 : undefined),
    offset: offset,
    // The sortable columns are on the versions, so the sort builder is handed it by name.
    orderBy: buildOrderByParam({ slug, locale, tables, by: sort, versions: contentTable })
  };
  Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

  const rawDocs = await (db.query as Record<string, any>)[table].findMany({
    ...params,
    columns: adapterUtil.columnsParams({ table: tables[table], select }),
    with: {
      [contentTable]: {
        with: withParam,
        where: whereParam,
        orderBy: [desc(tables[contentTable].updatedAt)],
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
        // A query forwarded to the content table can match nothing for a given document; that
        // document simply drops out of the result rather than failing the whole read.
        if (err instanceof RimeError && err.code === RimeError.NOT_FOUND) return false;
        throw err;
      }
    })
    .filter(Boolean);
};

/** Removes a document. Its content rows and children follow by cascade. */

type FindManyArgs = {
  versions?: VersionsTable;
  slug: string;
  select?: string[];
  query?: OperationQuery;
  sort?: string;
  limit?: number;
  offset?: number;
  locale?: string;
  /** Per document, which content row — see `readPrototype`. */
  content?: OperationQuery;
  config: BuiltCollection | BuiltArea;
};

/**
 * `findMany` alone reaches buildOrderByParam and buildWhereParam, which are typed against the
 * generated schema rather than against `Dic`. The facade this was moved from declared its tables
 * as `any` for that reason; keeping that here confines the looseness to the one operation that
 * needs it instead of widening `Deps` for everything.
 */
type DepsWithConfig = { db: any; tables: any; configCtx: ConfigContext };
