import type { VersionsTable } from '$lib/core/adapter.js';
import { normalizeQuery } from '$lib/core/pipeline/query.js';
import type { OperationQuery } from '$lib/core/pipeline/types.js';
import type { PrototypeSlug } from '$lib/core/prototype/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { Dic } from '$lib/util/types.js';
import { and, eq, inArray } from 'drizzle-orm';
import { RimeError } from '../core/errors/index.js';
import { baseTableName, tableName, type TableName } from './naming.server.js';
import * as adapterUtil from './columns.server.js';
import { buildWhereParam } from './where.server.js';

/**
 * Writing a prototype's rows — insert, update, delete, and the bootstrap a singleton needs.
 *
 * The other half of `read.server.ts`; the vocabulary is written down there. `singleton` decides
 * what `insert` and `delete` refuse outright, and which row an update resolves when it was handed
 * no id.
 *
 * Two apparent differences between the collection and area facades this replaces turned out to be
 * nothing: an area's update reset every content row's status with no `where` while a collection
 * scoped it to `ownerId = id` — the same set for a single row; and a collection split off its
 * `._root()` fields before writing while an area did not — `splitRootData` returns an empty half
 * when a config marks none. Both are core's now, and this is handed both halves.
 */

/**
 * Writes a row and, when it has localized columns, its `__$$locales` half.
 *
 * The pair appeared four times across the two facades this module replaces; they now all go
 * through here or through `ensurePrototypeExists`, which guards identically.
 *
 * The guard on `data` does not catch the empty locales row in notes/known-defects.md §2: a
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

type UpdateArgs = {
  slug: string;
  versions?: VersionsTable;
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
 * The content row's *table* is still the adapter's to know: registration carries the versions table, and
 * where rows live is storage. Which row, and whether to touch it, is the caller's.
 *
 * Returns `{ id: data.id || id }`. For an area the two always agree — it is a single row, so any
 * `id` in its data is that row's — and preferring `data.id` keeps a disagreement visible instead
 * of silently picking the id of the row that was written.
 */
export const updatePrototype = async (
  { db, tables }: Deps,
  { slug, id, data, content, locale, versions }: UpdateArgs
) => {
  const now = new Date();

  await writeRow({ db, tables }, { table: baseTableName(slug), recordId: id, data, locale, now });

  if (content) {
    // `versions!` — a plan names a content row only for a prototype that has one, and registration
    // answered with the versions table for exactly those.
    await writeRow(
      { db, tables },
      {
        table: baseTableName(versions!.slug),
        recordId: content.id,
        data: content.data,
        locale,
        now
      }
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
 * field" without knowing which of the two tables it is in.
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
 * The insert half of `updatePrototype`, and it reads the same way: the caller says which rows this
 * write touches, and this executes. Where a versioned config's `._root()` fields go is
 * `versionsWritePlan`'s statement, made before the call.
 *
 * `contentId` names the row the content landed on — the versions row when there is one, the base row
 * otherwise — which is what the caller hangs blocks, tree nodes and relations off.
 */
export const insertPrototype = async (
  { db, tables }: Deps,
  { slug, data, content, locale, versions }: InsertArgs
): Promise<{ id: string; contentId: string }> => {
  const now = new Date();

  if (versions) {
    // The base row has no columns for the content, so a plan naming no content half would write
    // half a document and hang its children off the base row. Loud, rather than silently wrong.
    if (!content) {
      throw new RimeError(
        RimeError.OPERATION_ERROR,
        `insert on "${slug}" names no content row, and its content lives on "${versions.slug}"`
      );
    }

    const docId = await adapterUtil.insertTableRecord(db, tables, baseTableName(slug), {
      createdAt: now,
      updatedAt: now,
      ...data
    });

    const contentTable = baseTableName(versions.slug);

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
  // No versions: the content is on the base row, so that is the row children hang off.
  return { id: docId, contentId: docId };
};

/**
 * Reads many documents, merged with the content row each should show.
 *
 * The versioned branch queries the base table and pulls one content row per document, because
 * pagination and ordering are properties of the document rather than of one of its rows.
 */

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
 * Cannot go through `findMany`: hierarchy lives on the base table while a versioned prototype's
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
  { slug, blank, locale, versions }: EnsureExistsArgs
): Promise<void> => {
  const table = baseTableName(slug);
  const [existing] = await db.select({ id: tables[table].id }).from(tables[table]);

  if (existing) return;

  const now = new Date();

  if (versions) {
    const docId = await adapterUtil.insertTableRecord(db, tables, table, {
      createdAt: now,
      updatedAt: now
    });

    const contentTable = baseTableName(versions.slug);

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
  // does not currently prevent the empty locales row described in notes/known-defects.md §2:
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
  versions?: VersionsTable;
  slug: string;
  data: Dic;
  /** No `id`: the row does not exist yet. See `Adapter.insert`. */
  content?: { data: Dic };
  locale?: string;
};

type EnsureExistsArgs = {
  versions?: VersionsTable;
  slug: string;
  /**
   * The document to write. Already shaped by whatever the prototype's features say a bootstrapped
   * first document carries — see `FeatureDefinition.blank` with intent `'seed'`. This module
   * writes it and asks nothing about what is in it.
   */
  blank: Dic;
  locale?: string;
};

/**
 * `updateWhere` alone reaches `buildWhereParam`, which is typed against the generated schema
 * rather than against `Dic`. Confining the looseness to the one operation that needs it beats
 * widening `Deps` for everything.
 */
type DepsWithConfig = { db: any; tables: any; configCtx: ConfigContext };
