import { VERSIONS_STATUS } from '$lib/core/constants.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import { VersionOperations } from '$lib/core/features/versions/strategy.js';
import type { BuiltArea, BuiltCollection } from '$lib/core/factory/config/types.js';
import type { VersionOperation } from '$lib/core/features/versions/strategy.js';
import type { Dic } from '$lib/util/types.js';
import { eq } from 'drizzle-orm';
import { RimeError } from '../core/errors/index.js';
import { baseTableName, tableName, type TableName } from './naming.server.js';
import * as adapterUtil from './util.server.js';
import { buildWithParam } from './with.server.js';

/**
 * What a collection and an area do identically.
 *
 * The two facades grew as copies: `update` was ~95 lines in each, with the same three
 * version-operation branches calling the same helpers in the same order. Diffing them, every
 * difference reduced to one thing — **who supplies the root row's id**. A collection is given
 * one; an area is a singleton and looks its own up first.
 *
 * The two other apparent differences fall out of that and are not differences at all:
 *
 * - An area's update reset every version row to draft with no `where`, a collection scoped the
 *   reset to `ownerId = id`. For a singleton those are the same set, so scoping always is
 *   behaviour-preserving.
 * - A collection extracted hierarchy fields (`_parent`, `_position`, `_path`) before writing;
 *   an area did not. `extractRootData` returns `{}` when none are present, and an area has
 *   none, so extracting always is behaviour-preserving too.
 *
 * This module is where the collapse lands: `collection.server.ts` and `area.server.ts` are
 * meant to shrink into it until the prototype facade is one thing with a singleton flag, as
 * docs/architecture-target.md describes.
 */

/**
 * Writes a row and, when it has localized columns, its `__$$locales` half.
 *
 * The pair appears four times across the two facades. Three are identical in shape — a version
 * row, a non-versioned collection row, an area's version row — and use it. The fourth, an
 * area's non-versioned bootstrap, is left alone: it writes no createdAt/updatedAt and guards the
 * locales insert without checking for empty data, and both look like oversights rather than
 * intent. Changing them belongs in a commit that can say so, not in an extraction.
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
    await adapterUtil.insertTableRecord(db, tables, tableName({ owner: args.table, branch: 'locales' }), {
      ...data,
      ownerId: id,
      locale: locale!
    });
  }

  return id;
};

type ReadArgs = {
  slug: string;
  /** Restrict to one root row. Omitted for a singleton, which has exactly one. */
  id?: string;
  versionId?: string;
  select?: string[];
  draft?: boolean;
  locale?: string;
  config: BuiltCollection | BuiltArea;
};

/**
 * Reads one prototype document, merged with the version it should show.
 *
 * Returns `undefined` when there is nothing to read rather than throwing, and the caller decides
 * what that means. Keeping the decision outside is what lets both facades share the query
 * building, which is the bulk of it — the nested version params were ~40 near-identical lines in
 * each. For a collection `undefined` is simply a 404.
 *
 * It does **not** mean "this prototype has never been written", and an area must not read it that
 * way: `undefined` also covers a row that exists with no version matching the `draft`/`versionId`
 * filter. Deciding to bootstrap on it creates a second singleton row. Ask the root table whether
 * the row is there — see area.server.ts.
 *
 * The only structural difference between the two reads is the `where` on the root row, and that
 * is the singleton difference again: a collection selects one row by id, an area has one row.
 */
export const readPrototype = async (
  { db, tables }: Deps,
  { slug, id, versionId, select, draft, locale, config }: ReadArgs
): Promise<Dic | undefined> => {
  const table = baseTableName(slug);
  const rootTable = tables[table];
  // Cast because with a single registered area the slug type collapses to one literal and
  // Drizzle infers an over-precise per-table shape instead of the general one.
  const queryTable = (db.query as Record<string, any>)[table];
  const byId = id ? { where: eq(rootTable.id, id) } : {};

  if (!config.versions) {
    return queryTable.findFirst({
      columns: adapterUtil.columnsParams({ table: rootTable, select }),
      ...byId,
      with: buildWithParam({ table, select, locale, tables, config }) || undefined
    });
  }

  const versionsTable = baseTableName(withVersionsSuffix(slug));

  const doc = await queryTable.findFirst({
    columns: adapterUtil.columnsParams({ table: rootTable, select }),
    ...byId,
    with: {
      [versionsTable]: {
        columns: adapterUtil.columnsParams({ table: tables[versionsTable], select }),
        with: buildWithParam({ table: versionsTable, select, locale, tables, config }),
        // A named version, or whichever one the draft flag says to show.
        ...(versionId
          ? { where: eq(tables[versionsTable].id, versionId) }
          : adapterUtil.buildPublishedOrLatestVersionParams({
              draft,
              config,
              table: tables[versionsTable]
            }))
      }
    }
  });

  // A root row with no versions is as good as absent — there is nothing to show.
  if (!doc || !doc[versionsTable] || doc[versionsTable].length === 0) return undefined;

  return adapterUtil.mergeRawDocumentWithVersion(doc, versionsTable, select);
};

type UpdateArgs = {
  slug: string;
  /** The root row to write. An area resolves its singleton's id before calling. */
  id: string;
  versionId?: string;
  data: Dic;
  locale?: string;
  versionOperation: VersionOperation;
  config: BuiltCollection | BuiltArea;
};

type Deps = {
  db: any;
  tables: Dic;
};

/**
 * Updates a prototype's root row, and its version row when the operation calls for one.
 *
 * Returns `{ id: data.id || id }`, which is what the collection did. The area returned its own
 * looked-up id; the two agree, because an area is a single row and any `id` in its data is that
 * row's. Keeping the collection's form makes the odd case visible rather than silently picking
 * a winner: if `data.id` ever disagreed with the row actually written, the old collection code
 * returned the one it had *not* written.
 */
export const updatePrototype = async (
  { db, tables }: Deps,
  { slug, id, versionId, data, locale, versionOperation, config }: UpdateArgs
) => {
  const now = new Date();

  if (VersionOperations.isSimpleUpdate(versionOperation)) {
    // Scenario 0: not versioned — the root row holds everything.
    const table = baseTableName(slug);
    const localesTable = tableName({ owner: table, branch: 'locales' });

    const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
      tables,
      mainTableName: table,
      localesTableName: localesTable,
      locale
    });

    await adapterUtil.updateTableRecord(db, tables, table, {
      recordId: id,
      data: { ...mainData, updatedAt: now }
    });

    if (isLocalized) {
      await adapterUtil.upsertLocalizedData(db, tables, localesTable, {
        ownerId: id,
        data: localizedData,
        locale: locale!
      });
    }

    return { id: data.id || id };
  }

  if (VersionOperations.isSpecificVersionUpdate(versionOperation)) {
    // Scenario 1: write into an existing version row.
    if (!versionId) {
      throw new RimeError(RimeError.OPERATION_ERROR, `missing versionId @adapter-update-${slug}`);
    }

    // Hierarchy fields live on the root, never on a version — otherwise the site tree would
    // fork per revision.
    const { data: contentData, rootData } = adapterUtil.extractRootData(data);

    await adapterUtil.updateTableRecord(db, tables, baseTableName(slug), {
      recordId: id,
      data: { updatedAt: now, ...rootData }
    });

    const versionsTable = baseTableName(withVersionsSuffix(slug));
    const versionsLocalesTable = tableName({ owner: versionsTable, branch: 'locales' });

    const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(contentData, {
      tables,
      mainTableName: versionsTable,
      localesTableName: versionsLocalesTable,
      locale
    });

    // Publishing demotes this document's other versions to draft first, so exactly one is
    // published at a time.
    if (config.versions && config.versions.draft && mainData.status === VERSIONS_STATUS.PUBLISHED) {
      await db
        .update(tables[versionsTable])
        .set({ status: VERSIONS_STATUS.DRAFT })
        .where(eq(tables[versionsTable].ownerId, id));
    }

    await adapterUtil.updateTableRecord(db, tables, versionsTable, {
      recordId: versionId,
      data: { ...mainData, updatedAt: now }
    });

    if (isLocalized) {
      await adapterUtil.upsertLocalizedData(db, tables, versionsLocalesTable, {
        ownerId: versionId,
        data: localizedData,
        locale: locale!
      });
    }

    return { id: data.id || id };
  }

  if (VersionOperations.isNewVersionCreation(versionOperation)) {
    // Scenario 2: the caller's operation creates the version row; only the root is touched here.
    const { rootData } = adapterUtil.extractRootData(data);

    await adapterUtil.updateTableRecord(db, tables, baseTableName(slug), {
      recordId: id,
      data: { updatedAt: now, ...rootData }
    });

    return { id: data.id || id };
  }

  throw new RimeError(RimeError.OPERATION_ERROR, 'Unhandled version operation');
};
