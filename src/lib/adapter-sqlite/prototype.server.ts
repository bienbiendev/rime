import { VERSIONS_STATUS } from '$lib/core/constants.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/config/types.js';
import { withDirectoriesSuffix } from '$lib/core/features/upload/naming.js';
import { getSegments } from '$lib/core/features/upload/util/path.js';
import type { ShadowDeclaration } from '$lib/core/features/define.js';
import { splitRootData } from '$lib/core/fields/util.js';
import { normalizeQuery } from '$lib/core/pipeline/query.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { PrototypeSlug, RawDoc } from '$lib/core/prototype/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import { trycatchSync } from '$lib/util/function.js';
import type { Dic } from '$lib/util/types.js';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
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
 * The adapter's vocabulary is the one in docs/decoupling-adapter.md: **base**, **shadow**
 * (the versions table), **child** (blocks, tree, the relations junction) and **branch** (the
 * localized half). "Collection" and "area" are not adapter words. They were, in the two facades
 * this module replaces, and that was the mistake: a whole parallel implementation existed
 * because the database layer thought the kinds were different things.
 *
 * They were not. Diffed, every difference between the two facades reduced to one — **who
 * supplies the root row's id**. Given one, or looking up the only row there is. Two apparent
 * differences turned out to be nothing at all:
 *
 * - An area's update reset every version row to draft with no `where`, a collection scoped the
 *   reset to `ownerId = id`. For a single row those are the same set, so scoping always is
 *   behaviour-preserving. (That reset is a versions hook now, not a write this module makes.)
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
 * Reads one prototype document, merged with the version it should show.
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
  const versionsTable = baseTableName(shadowSlug);

  const doc = await queryTable.findFirst({
    columns: adapterUtil.columnsParams({ table: rootTable, select }),
    ...byId,
    with: {
      [versionsTable]: {
        columns: adapterUtil.columnsParams({ table: tables[versionsTable], select }),
        with: buildWithParam({ table: versionsTable, select, locale, tables, config }),
        // The row the caller's filter names, else the newest — one query either way, and the
        // adapter chooses nothing. This was three branches decided here, off `draft`, `versionId`
        // and `config.versions.draft`: a named version, the published one, or the newest. Which
        // of those a request means is the versions feature's answer now (its `readQuery`), and it
        // arrives as an ordinary filter.
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
        orderBy: [desc(tables[versionsTable].updatedAt)],
        limit: 1
      }
    }
  });

  // A root row with no versions is as good as absent — there is nothing to show.
  if (!doc || !doc[versionsTable] || doc[versionsTable].length === 0) return undefined;

  return adapterUtil.mergeRawDocumentWithVersion(doc, versionsTable, config, select);
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
 * Three branches until 1ec2dfca's successor: the caller passed a `versionOperation` down and this
 * function decoded it into "not versioned", "write that version" and "the version already exists".
 * They differed in exactly two facts — is there a second row, and has somebody already written it
 * — and both are settled before the call now (core/pipeline/run.server.ts builds the plan,
 * features/versions/write-plan.ts is what refines it). What was left is the same two writes in
 * every case, so there is one path.
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
 * `updatedAt`, no locales, no children — because the callers that want a bulk column flip want the
 * rows left otherwise alone. `versions` demotes a document's other versions with it, and that
 * demotion depends on `updatedAt` *not* moving: pruning orders by it, so touching it here would
 * silently re-order which versions survive.
 *
 * It goes through `buildWhereParam`, so the filter is the same REST-shaped query every other
 * operation takes rather than a second dialect.
 */
export const updateWherePrototype = async (
  { db, tables, configCtx }: DepsWithConfig,
  { slug, query, data }: { slug: PrototypeSlug; query: OperationQuery; data: Dic }
): Promise<void> => {
  const table = baseTableName(slug);
  const where = buildWhereParam({ query: normalizeQuery(query), slug, db, tables, configCtx });

  await db.update(tables[table]).set(data).where(where);
};

/**
 * Writes a new document: the base row, and a first shadow row when the prototype is versioned.
 *
 * `contentId` names the row the content landed on — the shadow row when there is one, the base row
 * otherwise — which is what the caller hangs blocks, tree nodes and relations off.
 */
export const insertPrototype = async (
  { db, tables }: Deps,
  { slug, data, locale, config, shadow }: InsertArgs
): Promise<{ id: string; contentId: string }> => {
  const now = new Date();

  // FEATURE (upload): normalise the incoming path and make sure the folder it names exists.
  // This is the upload feature reaching into a write, and it moves out of here when features
  // land — see docs/architecture-target.md. Until then it has to stay: without it `_path` is
  // written unnormalised (null for a bare filename) and no directory row is ever created.
  // `'upload' in config` rather than a kind check: the question is whether this config carries
  // upload settings, which is a shape the adapter can see. Whether it is a "collection" is not.
  if ('upload' in config && config.upload) {
    const [error, segments] = trycatchSync(() => getSegments(data._path));
    if (error) throw new RimeError(RimeError.BAD_REQUEST, error.message);

    const { path, name, parent } = segments;
    data._path = path;

    const directoriesTable = baseTableName(withDirectoriesSuffix(slug));
    const table = tables[directoriesTable];

    const existing = await (db.query as Record<string, any>)[directoriesTable].findFirst({
      where: and(eq(table.id, data._path))
    });

    if (!existing) {
      await db.insert(table).values({
        id: data._path,
        parent,
        name,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  if (shadow) {
    // Hierarchy and upload roots live on the root row, never on a version. Still split here
    // rather than by a plan: an insert has no row to name yet, so the caller has nothing to say
    // that this cannot work out. See docs/decoupling-versions.md stage 4.
    const { base, content: contentData } = splitRootData(data, config);

    const docId = await adapterUtil.insertTableRecord(db, tables, baseTableName(slug), {
      createdAt: now,
      updatedAt: now,
      ...base
    });

    const versionsTable = baseTableName(shadow.slug);

    const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(contentData, {
      tables,
      mainTableName: versionsTable,
      localesTableName: tableName({ owner: versionsTable, branch: 'locales' }),
      locale
    });

    const contentId = await insertRowWithLocales(
      { db, tables },
      {
        table: versionsTable,
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

  // No version row exists, so the two ids are the same thing.
  // No shadow: the content is on the base row, so that is the row children hang off.
  return { id: docId, contentId: docId };
};

/**
 * Reads many documents, merged with the version each should show.
 *
 * The versioned branch queries the root table and pulls one version row per document, because
 * pagination and ordering are properties of the document rather than of a revision.
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
  const versionsTable = baseTableName(shadowSlug);
  const withParam =
    buildWithParam({ table: versionsTable, select, tables, config, locale }) || undefined;

  // The caller's own filter, and the one saying which content row each document shows. Both
  // resolve against the shadow, so they are two wheres to `and` rather than two query objects to
  // splice — which is what this was, a `status: published` condition spliced into somebody else's
  // `where` by hand, behind `!draft && config.versions.draft`.
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
    orderBy: buildOrderByParam({ slug, locale, tables, by: sort, shadow: versionsTable })
  };
  Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

  const rawDocs = await (db.query as Record<string, any>)[table].findMany({
    ...params,
    columns: adapterUtil.columnsParams({ table: tables[table], select }),
    with: {
      [versionsTable]: {
        with: withParam,
        where: whereParam,
        orderBy: [desc(tables[versionsTable].updatedAt)],
        limit: 1,
        columns: adapterUtil.columnsParams({ table: tables[versionsTable], select })
      }
    }
  });

  return rawDocs
    .map((doc: RawDoc) => {
      try {
        return adapterUtil.mergeRawDocumentWithVersion(doc, versionsTable, config, select);
      } catch (err: any) {
        // A query forwarded to the versions table can match nothing for a given document; that
        // document simply drops out of the result rather than failing the whole read.
        if (err instanceof RimeError && err.code === RimeError.NOT_FOUND) return false;
        throw err;
      }
    })
    .filter(Boolean);
};

/** Removes a document. Versions and children follow by cascade. */
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
 * Cannot go through `findMany`: hierarchy lives on the root table while a versioned prototype's
 * `where` resolves against the versions table. `_parent` and `_position` are columns the adapter
 * writes itself, so answering this is its job.
 */
export const childrenIds = async (
  { db, tables }: Deps,
  { slug, parentId }: { slug: string; parentId: string }
): Promise<string[]> => {
  const table = tables[baseTableName(slug)];

  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table._parent, parentId))
    .orderBy(asc(table._position));

  return rows.map((row: { id: string }) => row.id);
};

/** Which of `ids` name a document that exists, in table order. */
export const existingIds = async (
  { db, tables }: Deps,
  { slug, ids }: { slug: string; ids: string[] }
): Promise<string[]> => {
  if (!ids.length) return [];

  const table = tables[baseTableName(slug)];
  const rows = await db.select({ id: table.id }).from(table).where(inArray(table.id, ids));

  return rows.map((row: { id: string }) => row.id);
};

/**
 * Brings a singleton's row into being if it is not already there. Boot only.
 *
 * Deliberately not an `insert`: it takes no data beyond the blank document, hands back no id,
 * and a second call does nothing. That shape is what lets a singleton have no create at all
 * while its one row still comes from somewhere.
 */
export const ensurePrototypeExists = async (
  { db, tables }: Deps,
  { slug, blank, locale, config, shadow }: EnsureExistsArgs
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

    const versionsTable = baseTableName(shadow.slug);

    const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(blank, {
      tables,
      mainTableName: versionsTable,
      localesTableName: tableName({ owner: versionsTable, branch: 'locales' }),
      locale,
      fillNotNull: true
    });

    // A draft-enabled prototype's first version is published; otherwise nothing would be
    // readable without `draft: true`.
    // Still a `config.versions` read, and the last one on a write path: *whether* a shadow exists
    // is declared, what its first row means is not. It goes when the insert takes a plan too —
    // docs/decoupling-versions.md stage 4.
    if (config.versions?.draft) mainData.status = VERSIONS_STATUS.PUBLISHED;

    await insertRowWithLocales(
      { db, tables },
      {
        table: versionsTable,
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
  locale?: string;
  config: BuiltCollection | BuiltArea;
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
  blank: Dic;
  locale?: string;
  config: BuiltCollection | BuiltArea;
};

/**
 * `findMany` alone reaches buildOrderByParam and buildWhereParam, which are typed against the
 * generated schema rather than against `Dic`. The facade this was moved from declared its tables
 * as `any` for that reason; keeping that here confines the looseness to the one operation that
 * needs it instead of widening `Deps` for everything.
 */
type DepsWithConfig = { db: any; tables: any; configCtx: ConfigContext };
