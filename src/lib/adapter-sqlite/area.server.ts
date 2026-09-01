import { VERSIONS_OPERATIONS } from '$lib/core/features/versions/strategy.js';
import type { Config } from '$lib/core/factory/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import type { ConfigContext } from '$lib/core/rime/index.server.js';
import type { AreaSlug, GenericDoc, RawDoc } from '$lib/core/prototype/types.js';
import type { GetRegisterType } from '$lib/index.js';
import type { DeepPartial } from '$lib/util/types.js';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as adapterUtil from './util.server.js';
import { baseTableName, tableName } from './naming.server.js';
import { insertRowWithLocales, readPrototype, updatePrototype } from './prototype.server.js';

/**
 * Creates an area facade for SQLite adapter operations with CRUD functionality.
 * Handles both versioned and non-versioned areas with support for localization.
 */
const createAreaFacade = <const C extends Config>(args: {
  db: LibSQLDatabase<GetRegisterType<'Schema'>>;
  tables: any;
  configCtx: ConfigContext<C>;
}) => {
  const { db, tables, configCtx } = args;

  /**
   * Reads the area's document. A plain read, exactly like a collection's findById.
   *
   * It used to bootstrap: check for the row, create it when absent, then read. That put a write
   * behind a GET and cost an extra SELECT on every read forever, to answer a question whose
   * answer is "yes" for the entire life of the process after the first time. `definePrototype`
   * answers it once at boot instead, so by the time any of this runs the row exists.
   */
  const get: Get = async ({ slug, locale, select, versionId, draft }) => {
    const areaConfig = configCtx.areas[slug];
    if (!areaConfig) {
      throw new RimeError(RimeError.INIT, slug + ' is not an area, should never happen');
    }

    // No `id`: an area is a singleton, so there is exactly one row to find.
    const doc = await readPrototype(
      { db, tables },
      { slug, versionId, select, locale, draft, config: areaConfig }
    );

    // The row is there — boot saw to that — so an empty read means no version matched the
    // draft/versionId filter, which is the same 404 a collection gives.
    if (!doc) throw new RimeError(RimeError.NOT_FOUND);

    return doc as RawDoc;
  };

  /**
   * Brings the singleton into being, if it is not already. Boot only — see definePrototype.
   *
   * Deliberately not an `insert`. An area has exactly one row, so the operation a caller is
   * allowed to ask for is not "create one" but "make sure the one exists": it takes no data
   * beyond the blank document, returns no id, and doing it twice does nothing the second time.
   * That is what keeps create genuinely off an area's runtime surface while still letting the
   * row come from somewhere.
   */
  const ensureExists: EnsureExists = async ({ slug, blank, locale }) => {
    const rootTable = tables[baseTableName(slug)];
    const [existing] = await db.select({ id: rootTable.id }).from(rootTable);

    if (existing) return;

    await createArea(slug, blank, locale);
  };

  /**
   * Creates a new area document. For versioned areas, creates both
   * the root document and its first version. For non-versioned areas,
   * creates a single document with the provided data.
   *
   * @example
   * // Create a new area
   * await createArea(
   *   'settings',
   *   { theme: 'light', notifications: true },
   *   'en'
   * );
   *
   * @returns For versioned areas, returns object with id and versionId
   */
  const createArea = async (slug: AreaSlug, values: Partial<GenericDoc>, locale?: string) => {
    const now = new Date();
    const config = configCtx.areas[slug];

    const hasVersions = !!config.versions;

    if (hasVersions) {
      // Create root document first
      const docId = await adapterUtil.insertTableRecord(db, tables, baseTableName(slug), {
        createdAt: now,
        updatedAt: now
      });

      // Generate version ID
      const versionsTableName = baseTableName(withVersionsSuffix(slug));

      // Prepare data for versions table
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(values, {
        tables,
        mainTableName: versionsTableName,
        localesTableName: tableName({ owner: versionsTableName, branch: 'locales' }),
        locale,
        fillNotNull: true
      });

      if (config.versions && config.versions.draft) {
        mainData.status = 'published';
      }

      const versionId = await insertRowWithLocales(
        { db, tables },
        {
          table: versionsTableName,
          row: { ownerId: docId, ...mainData },
          now,
          localized: { data: localizedData, isLocalized, locale }
        }
      );

      // Return both IDs for versioned collections
      return {
        id: docId,
        versionId
      };
    } else {
      const tableLocales = tableName({ owner: baseTableName(slug), branch: 'locales' });

      // Prepare data for insertion using the shared utility function
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(values, {
        tables,
        mainTableName: baseTableName(slug),
        localesTableName: tableLocales,
        locale,
        fillNotNull: true
      });

      // Insert main record
      const createId = await adapterUtil.insertTableRecord(db, tables, baseTableName(slug), {
        ...mainData
      });

      // Insert localized data if needed
      if (isLocalized) {
        await adapterUtil.insertTableRecord(db, tables, tableLocales, {
          ...localizedData,
          ownerId: createId,
          locale
        });
      }
    }
  };

  /**
   * Updates an area document using different versioning strategies.
   * Supports multiple update patterns:
   * - Simple update for non-versioned areas
   * - Direct version update for versioned areas
   * - Creating new versions from existing ones
   * - Publishing draft versions
   *
   * @example
   * // Update a non-versioned area
   * const { id, versionId } = await update({
   *   slug: 'settings',
   *   data: { theme: 'dark' },
   *   versionOperation: VERSIONS_OPERATIONS.UPDATE
   * });
   *
   * // Update a specific version
   * const { id, versionId } = await update({
   *   slug: 'site-info',
   *   data: { title: 'Updated Title' },
   *   versionId: 'v456',
   *   versionOperation: VERSIONS_OPERATIONS.UPDATE_VERSION
   * });
   *
   * // Create a new draft from published version
   * const { id, versionId } = await update({
   *   slug: 'settings',
   *   data: { theme: 'system' },
   *   versionOperation: VERSIONS_OPERATIONS.NEW_DRAFT_FROM_PUBLISHED
   * });
   *
   * @returns Object containing the IDs of the updated area and version
   * @throws RimeError when operation fails or version ID is missing when required
   */
  const update: Update = async ({ slug, data, locale, versionId, versionOperation }) => {
    // The one thing an area does differently: it has no id to be given, so it finds its single
    // row first. Everything after that is identical to a collection's update.
    const [area] = await db
      .select({ id: tables[baseTableName(slug)].id })
      .from(tables[baseTableName(slug)]);

    return updatePrototype(
      { db, tables },
      {
        slug,
        id: area.id,
        versionId,
        data,
        locale,
        versionOperation,
        config: configCtx.areas[slug]
      }
    );
  };

  return {
    update,
    get,
    ensureExists
  };
};

export default createAreaFacade;

/****************************************************/
/* Types
/****************************************************/

type Get = (args: {
  slug: AreaSlug;
  locale?: string;
  depth?: number;
  select?: string[];
  /** Optional parameter to get a specific version */
  versionId?: string;
  /** Optional parameter if versionId is not defined and draft=true
   * 	it will get the latest doc no matter its status
   * 	else the published document will be retrieved
   */
  draft?: boolean;
}) => Promise<RawDoc>;

type EnsureExists = (args: {
  slug: AreaSlug;
  /** The document to write when the row is absent, already built by the caller. */
  blank: Partial<GenericDoc>;
  locale?: string;
}) => Promise<void>;

type Update = (args: {
  slug: AreaSlug;
  data: DeepPartial<GenericDoc>;
  locale?: string;
  /** Optional parameter to specify direct version update */
  versionId?: string;
  versionOperation: (typeof VERSIONS_OPERATIONS)[keyof typeof VERSIONS_OPERATIONS];
}) => Promise<{ id: string }>;
