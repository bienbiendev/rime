import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import type { ShadowDeclaration } from '$lib/core/features/define.js';
import { normalizeQuery } from '$lib/core/pipeline/query.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { PrototypeSlug, RawDoc } from '$lib/core/prototype/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { RimeError } from '../core/errors/index.js';
import { baseTableName, tableName, type TableName } from './naming.server.js';
import { buildOrderByParam } from './orderBy.server.js';
import * as adapterUtil from './util.server.js';
import { buildWhereParam } from './where.server.js';
import { buildWithParam } from './with.server.js';

/**
 * Everything the adapter can do to a prototype's tables — and it does not know what kind of
 * prototype it is holding.
 *
 * The adapter's vocabulary is the one in docs/decoupling.md, appendix A: **base**, **shadow**
 * (a second table holding the content), **child** (blocks, tree, the relations junction) and **branch** (the
 * localized half). "Collection" and "area" are not adapter words. They were, in the two facades
 * this module replaces, and that was the mistake: a whole parallel implementation existed
 * because the database layer thought the kinds were different things.
 *
 * They were not. Diffed, every difference between the two facades reduced to one — **who
 * supplies the root row's id**. Given one, or looking up the only row there is. Two apparent
 * differences turned out to be nothing at all:
 *
 * - An area's update reset every content row's status with no `where`, a collection scoped the
 *   reset to `ownerId = id`. For a single row those are the same set, so scoping always is
 *   behaviour-preserving. (That reset is a feature's hook now, not a write this module makes.)
 * - A collection split off the fields its config keeps on the base row before writing; an area did
 *   not. `splitRootData` returns an empty half when a config marks none, so splitting always is
 *   behaviour-preserving too. (The split is core's now; this module is handed both halves.)
 *
 * `singleton` survives here as the one thing the adapter genuinely needs to know, and it is a
 * property of the *data* — how many rows there are — not of a kind. It decides whether `find`
 * needs an id, and it is what `insert` and `delete` refuse on.
 *
 * Which of these a caller may reach is not decided here. The prototype definitions in
 * core/prototype/ declare their own surface; this is the toolbox they build it from.
 */

/**
 * Writes a row and, when it has localized columns, its `__$$locales` half.
 *
 * The pair appeared four times across the two facades this module replaces; they now all go
 * through here or through `ensurePrototypeExists`, which guards identically.
 *
 * The guard on `data` does not catch the empty locales row in docs/known-defects.md §2: a
 * bootstrap prepares its data with `fillNotNull`, which seeds the primary key, so the object is
 * never empty even when every localized value is null.
 *
 * Returns the id actually written, which insertTableRecord derives from `row.id` or generates.
 */
export const insertRowWithLocales = async (
  { db, tables }: Deps,
  args: {
    table: TableName;
    row: Dic;
    now: Date;
    localized: { data: Dic; isLocalized: boolean; locale?: string };
  }
): Promise<string> => {
  const id = await adapterUtil.insertTableRecord(db, tables, args.table, {
    ...args.row,
    createdAt: args.now,
    updatedAt: args.now
  });

  const { data, isLocalized, locale } = args.localized;
  if (isLocalized && Object.keys(data).length) {
    await adapterUtil.insertTableRecord(
      db,
      tables,
      tableName({ owner: args.table, branch: 'locales' }),
      {
        ...data,
        ownerId: id,
        locale: locale!
      }
    );
  }

  return id;
};

type ReadArgs = {
  slug: string;
  /** Where the content lives, when not on the base row — see `RegisterPrototypeArgs.shadow`. */
  shadow?: ShadowDeclaration;
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
  { slug, id, select, locale, content, config, shadow }: ReadArgs
): Promise<Dic | undefined> => {
  const table = baseTableName(slug);
  const rootTable = tables[table];
  // Cast because with a single registered area the slug type collapses to one literal and
  // Drizzle infers an over-precise per-table shape instead of the general one.
  const queryTable = (db.query as Record<string, any>)[table];
  const byId = id ? { where: eq(rootTable.id, id) } : {};

  // No shadow: the content is on the base row and there is nothing to merge.
  if (!shadow) {
    return queryTable.findFirst({
      columns: adapterUtil.columnsParams({ table: rootTable, select }),
      ...byId,
      with: buildWithParam({ table, select, locale, tables, config }) || undefined
    });
  }

  // See findManyPrototypes for why the shadow's slug is castable.
  const shadowSlug = shadow.slug as PrototypeSlug;
  const contentTable = baseTableName(shadowSlug);

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
                slug: shadowSlug,
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

type UpdateArgs = {
  slug: string;
  shadow?: ShadowDeclaration;
  /** The base row to write. An area resolves its singleton's id before calling. */
  id: string;
  /** What goes on it. */
  data: Dic;
  /** And the content row this write also touches, when the caller named one. */
  content?: { id: string; data: Dic };
  locale?: string;
};

type Deps = {
  db: any;
  tables: Dic;
};

/**
 * Writes the rows the caller's plan names.
 *
 * Three branches until 1ec2dfca's successor, decoded here from an enum the caller passed down.
 * They differed in exactly two facts — is there a second row, and has somebody already written it
 * — and both are settled before the call now (`core/pipeline/run.server.ts` builds the plan,
 * `FeatureDefinition.writePlan` refines it). What was left is the same two writes in every case,
 * so there is one path.
 *
 * The content row's *table* is still the adapter's to know: registration carries the shadow, and
 * where rows live is storage. Which row, and whether to touch it, is the caller's.
 *
 * Returns `{ id: data.id || id }`. For an area the two always agree — it is a single row, so any
 * `id` in its data is that row's — and preferring `data.id` keeps a disagreement visible instead
 * of silently picking the id of the row that was written.
 */
export const updatePrototype = async (
  { db, tables }: Deps,
  { slug, id, data, content, locale, shadow }: UpdateArgs
) => {
  const now = new Date();

  await writeRow({ db, tables }, { table: baseTableName(slug), recordId: id, data, locale, now });

  if (content) {
    // `shadow!` — a plan names a content row only for a prototype that has one, and registration
    // answered with the shadow for exactly those.
    await writeRow(
      { db, tables },
      { table: baseTableName(shadow!.slug), recordId: content.id, data: content.data, locale, now }
    );
  }

  return { id: data.id || id };
};

/** One row and its locales, which is what both halves of an update come down to. */
const writeRow = async (
  { db, tables }: Deps,
  args: { table: TableName; recordId: string; data: Dic; locale?: string; now: Date }
) => {
  const { table, recordId, data, locale, now } = args;
  const localesTable = tableName({ owner: table, branch: 'locales' });

  const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
    tables,
    mainTableName: table,
    localesTableName: localesTable,
    locale
  });

  await adapterUtil.updateTableRecord(db, tables, table, {
    recordId,
    data: { ...mainData, updatedAt: now }
  });

  if (isLocalized) {
    await adapterUtil.upsertLocalizedData(db, tables, localesTable, {
      ownerId: recordId,
      data: localizedData,
      locale: locale!
    });
  }
};

/**
 * Sets columns on every row of this prototype's own table that `query` matches.
 *
 * A primitive: a table, a filter, a patch. It writes exactly the columns it is given — no
 * `updatedAt`, no children — because the callers that want a bulk column write want the rows left
 * otherwise alone. Its one caller flips a status column across a document's other content rows,
 * and depends on `updatedAt` *not* moving: that caller prunes by `updatedAt`, so touching it here
 * would silently re-order which rows survive.
 *
 * With `locale`, a localized column lands on the `__$$locales` branch instead — resolved by
 * `prepareSchemaData`, the same split every other write goes through, so a caller says "set this
 * field" and does not have to know which of the two tables the field is in. That is what a
 * computed column written back on read needs — localized on a localized config and not otherwise
 * — and the adapter used to carry a whole method with a four-way branch for exactly that.
 *
 * It goes through `buildWhereParam`, so the filter is the same REST-shaped query every other
 * operation takes rather than a second dialect.
 */
export const updateWherePrototype = async (
  { db, tables, configCtx }: DepsWithConfig,
  {
    slug,
    query,
    data,
    locale
  }: { slug: PrototypeSlug; query: OperationQuery; data: Dic; locale?: string }
): Promise<void> => {
  const table = baseTableName(slug);
  const localesTable = tableName({ owner: table, branch: 'locales' });
  const where = buildWhereParam({ query: normalizeQuery(query), slug, db, tables, configCtx });

  const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
    tables,
    mainTableName: table,
    localesTableName: localesTable,
    locale
  });

  if (Object.keys(mainData).length) {
    await db.update(tables[table]).set(mainData).where(where);
  }

  if (isLocalized && Object.keys(localizedData).length) {
    // The branch is keyed by its owner, so the rows to touch are the ones this filter matched.
    //
    // An update, never an upsert — `upsertLocalizedData` would *insert* a locales row for a
    // document that has none yet, and its caller runs during reads. A half-populated
    // locales row written ahead of the real one is how the multilingual duplicate tests started
    // failing when this was first written as an upsert.
    const owners = await db.select({ id: tables[table].id }).from(tables[table]).where(where);
    const ownerIds = (owners as { id: string }[]).map((owner) => owner.id);

    if (ownerIds.length) {
      const branch = tables[localesTable];
      await db
        .update(branch)
        .set(localizedData)
        .where(and(inArray(branch.ownerId, ownerIds), eq(branch.locale, locale!)));
    }
  }
};

/**
 * Writes a new document: the rows the plan names.
 *
 * The insert half of `updatePrototype`, and it reads the same way now — the caller says which
 * rows this write touches and this executes. It used to call `splitRootData` itself, which meant
 * the database layer knew that a shadowed config keeps its `._root()` fields on the base row; that
 * is the shadow-declaring feature's rule, and it states it in `writePlan` (docs/decoupling.md § 4.4).
 *
 * `contentId` names the row the content landed on — the shadow row when there is one, the base row
 * otherwise — which is what the caller hangs blocks, tree nodes and relations off.
 */
export const insertPrototype = async (
  { db, tables }: Deps,
  { slug, data, content, locale, shadow }: InsertArgs
): Promise<{ id: string; contentId: string }> => {
  const now = new Date();

  if (shadow) {
    // The base row has no columns for the content, so a plan naming no content half would write
    // half a document and hang its children off the base row. Loud, rather than silently wrong.
    if (!content) {
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        `insert on "${slug}" names no content row, and its content lives on "${shadow.slug}"`
      );
    }

    const docId = await adapterUtil.insertTableRecord(db, tables, baseTableName(slug), {
      createdAt: now,
      updatedAt: now,
      ...data
    });

    const contentTable = baseTableName(shadow.slug);

    const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(content.data, {
      tables,
      mainTableName: contentTable,
      localesTableName: tableName({ owner: contentTable, branch: 'locales' }),
      locale
    });

    const contentId = await insertRowWithLocales(
      { db, tables },
      {
        table: contentTable,
        row: { id: adapterUtil.generatePK(), ownerId: docId, ...mainData },
        now,
        localized: { data: localizedData, isLocalized, locale }
      }
    );

    return { id: docId, contentId };
  }

  const docId = data.id || adapterUtil.generatePK();
  const table = baseTableName(slug);

  const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
    tables,
    mainTableName: table,
    localesTableName: tableName({ owner: table, branch: 'locales' }),
    locale
  });

  await insertRowWithLocales(
    { db, tables },
    {
      table,
      row: { id: docId, ...mainData },
      now,
      localized: { data: localizedData, isLocalized, locale }
    }
  );

  // No second row exists, so the two ids are the same thing.
  // No shadow: the content is on the base row, so that is the row children hang off.
  return { id: docId, contentId: docId };
};

/**
 * Reads many documents, merged with the content row each should show.
 *
 * The shadowed branch queries the base table and pulls one content row per document, because
 * pagination and ordering are properties of the document rather than of one of its rows.
 */
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
    shadow
  } = args;
  // buildOrderByParam and buildWhereParam resolve fields against the config, so they take a
  // prototype slug. Registration guarantees this one is registered, hence is one.
  const slug = args.slug as PrototypeSlug;
  const table = baseTableName(slug);
  const query = incomingQuery ? normalizeQuery(incomingQuery) : undefined;

  // No shadow: everything is on the base table, so this is one plain query.
  if (!shadow) {
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
  // `ShadowDeclaration.slug` is a plain string on purpose — a feature names a slug, and only the
  // registry knows which slugs exist. The cast is the same one `slug` above takes, and sound for
  // the same reason: a shadow is a registered prototype in its own right (the feature that
  // declares one also derives its config), so `buildWhereParam` can resolve fields against it.
  const shadowSlug = shadow.slug as PrototypeSlug;
  const contentTable = baseTableName(shadowSlug);
  const withParam =
    buildWithParam({ table: contentTable, select, tables, config, locale }) || undefined;

  // The caller's own filter, and the one saying which content row each document shows. Both
  // resolve against the shadow, so they are two wheres to `and` rather than two query objects to
  // splice — which is what this was, a condition spliced into somebody else's `where` by hand
  // behind a config read.
  const wheres = [query, content && normalizeQuery(content)]
    .filter((one) => !!one)
    .map((one) =>
      buildWhereParam({ query: one, slug: shadowSlug, base: slug, locale, db, configCtx, tables })
    )
    // Only `undefined` drops out. `buildWhereParam` answers `false` for a degenerate query (an
    // empty `and`/`or`), and that was passed straight to drizzle before; it still is.
    .filter((one) => one !== undefined);

  const whereParam = wheres.length > 1 ? and(...wheres) : wheres[0];

  const params: Dic = {
    limit: limit || (typeof offset === 'number' ? 1000000 : undefined),
    offset: offset,
    // The sortable columns are on the shadow, so the sort builder is handed it by name.
    orderBy: buildOrderByParam({ slug, locale, tables, by: sort, shadow: contentTable })
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
export const deletePrototype = async (
  { db, tables }: Deps,
  { slug, id }: { slug: string; id: string }
): Promise<string | undefined> => {
  const table = tables[baseTableName(slug)];
  const docs = await db.delete(table).where(eq(table.id, id)).returning();

  if (!docs || !Array.isArray(docs) || !docs.length) throw new RimeError(RimeError.NOT_FOUND);

  return docs[0].id;
};

/**
 * The ids of the documents whose `_parent` is `parentId`, in `_position` order.
 *
 * Cannot go through `findMany`: hierarchy lives on the base table while a shadowed prototype's
 * `where` resolves against the content table. `_parent` and `_position` are columns the adapter
 * writes itself, so answering this is its job.
 */
/**
 * Brings a singleton's row into being if it is not already there. Boot only.
 *
 * Deliberately not an `insert`: it takes no data beyond the blank document, hands back no id,
 * and a second call does nothing. That shape is what lets a singleton have no create at all
 * while its one row still comes from somewhere.
 */
export const ensurePrototypeExists = async (
  { db, tables }: Deps,
  { slug, blank, locale, shadow }: EnsureExistsArgs
): Promise<void> => {
  const table = baseTableName(slug);
  const [existing] = await db.select({ id: tables[table].id }).from(tables[table]);

  if (existing) return;

  const now = new Date();

  if (shadow) {
    const docId = await adapterUtil.insertTableRecord(db, tables, table, {
      createdAt: now,
      updatedAt: now
    });

    const contentTable = baseTableName(shadow.slug);

    const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(blank, {
      tables,
      mainTableName: contentTable,
      localesTableName: tableName({ owner: contentTable, branch: 'locales' }),
      locale,
      fillNotNull: true
    });

    await insertRowWithLocales(
      { db, tables },
      {
        table: contentTable,
        row: { ownerId: docId, ...mainData },
        now,
        localized: { data: localizedData, isLocalized, locale }
      }
    );

    return;
  }

  const localesTable = tableName({ owner: table, branch: 'locales' });

  const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(blank, {
    tables,
    mainTableName: table,
    localesTableName: localesTable,
    locale,
    fillNotNull: true
  });

  const createId = await adapterUtil.insertTableRecord(db, tables, table, { ...mainData });

  // Guarded on the data as well as on `isLocalized`, matching insertRowWithLocales. Note this
  // does not currently prevent the empty locales row described in docs/known-defects.md §2:
  // `fillNotNull` seeds a primary key, so `localizedData` is never empty here even when every
  // localized value is null. Fixing that means not counting the seeded id, and belongs in its
  // own commit — see the doc.
  if (isLocalized && Object.keys(localizedData).length) {
    await adapterUtil.insertTableRecord(db, tables, localesTable, {
      ...localizedData,
      ownerId: createId,
      locale
    });
  }
};

type InsertArgs = {
  shadow?: ShadowDeclaration;
  slug: string;
  data: Dic;
  /** No `id`: the row does not exist yet. See `Adapter.insert`. */
  content?: { data: Dic };
  locale?: string;
};

type FindManyArgs = {
  shadow?: ShadowDeclaration;
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

type EnsureExistsArgs = {
  shadow?: ShadowDeclaration;
  slug: string;
  /**
   * The document to write. Already shaped by whatever the prototype's features say a bootstrapped
   * first document carries — see `FeatureDefinition.seed`. This module writes it and asks nothing
   * about what is in it.
   */
  blank: Dic;
  locale?: string;
};

/**
 * `findMany` alone reaches buildOrderByParam and buildWhereParam, which are typed against the
 * generated schema rather than against `Dic`. The facade this was moved from declared its tables
 * as `any` for that reason; keeping that here confines the looseness to the one operation that
 * needs it instead of widening `Deps` for everything.
 */
type DepsWithConfig = { db: any; tables: any; configCtx: ConfigContext };
