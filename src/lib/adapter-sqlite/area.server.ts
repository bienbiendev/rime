import { getRequestEvent } from '$app/server';
import { VERSIONS_OPERATIONS } from '$lib/core/features/versions/strategy.js';
import type { Config } from '$lib/core/factory/config/types.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import type { ConfigContext } from '$lib/core/rime/index.server.js';
import type { AreaSlug, GenericDoc, RawDoc } from '$lib/core/prototype/types.js';
import type { GetRegisterType } from '$lib/index.js';
import { createBlankDocument } from '$lib/core/prototype/doc.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as adapterUtil from './util.server.js';
import { buildWithParam } from './with.server.js';
import { baseTableName, tableName } from './naming.server.js';
import { insertRowWithLocales, updatePrototype } from './prototype.server.js';

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
   * Retrieves an area document. If the area doesn't exist, it creates a blank one.
   * For versioned areas, returns either a specific version (if versionId is provided)
   * or the latest/published version.
   */
  const get: Get = async ({ slug, locale, select, versionId, draft }) => {
    const areaConfig = configCtx.areas[slug];
    if (!areaConfig) {
      throw new RimeError(RimeError.INIT, slug + ' is not an area, should never happen');
    }

    // `db.query[baseTableName(slug)]` can't be typed precisely: with a single registered area,
    // AreaSlug collapses to one string literal and Drizzle infers an overly
    // precise (and here incorrect) per-table shape instead of the general one.
    const queryTable = (db.query as Record<string, any>)[slug];

    const hasVersions = !!areaConfig.versions;

    if (!hasVersions) {
      const params = {
        columns: adapterUtil.columnsParams({ table: tables[baseTableName(slug)], select }),
        with: buildWithParam({ table: baseTableName(slug), select, locale, tables, config: areaConfig }) || undefined
      };

      let doc: RawDoc | undefined = await queryTable.findFirst(params);

      if (!doc) {
        await createArea(slug, createBlankDocument(areaConfig, getRequestEvent()), locale);
        doc = await queryTable.findFirst(params);
      }
      if (!doc) {
        throw new Error('Database error');
      }
      return doc;
    } else {
      // First check for record presence
      const area = await queryTable.findFirst({ id: true });

      // If no area exists yet, create it
      if (!area) {
        await createArea(slug, createBlankDocument(areaConfig, getRequestEvent()), locale);
      }

      // Implementation for versioned areas
      const versionsTable = baseTableName(withVersionsSuffix(slug));
      const withParam = buildWithParam({
        table: versionsTable,
        select,
        locale,
        tables,
        config: areaConfig
      });

      // Handle select columns for version table
      const versionSelectColumns = adapterUtil.columnsParams({
        table: tables[versionsTable],
        select
      });
      // Handle select columns for root table
      const rootSelectColumns = adapterUtil.columnsParams({ table: tables[baseTableName(slug)], select });

      // Configure the query based on whether we want a specific version or the latest
      // For the "save in a new draft" action we need to get the published version
      let params: Dic;

      if (versionId) {
        // If versionId is provided, get that specific version
        params = {
          columns: rootSelectColumns,
          with: {
            [versionsTable]: {
              columns: versionSelectColumns,
              with: withParam,
              where: eq(tables[versionsTable].id, versionId)
            }
          }
        };
      } else {
        // get the latest
        params = {
          columns: rootSelectColumns,
          with: {
            [versionsTable]: {
              columns: versionSelectColumns,
              with: withParam,
              ...adapterUtil.buildPublishedOrLatestVersionParams({
                draft,
                config: areaConfig,
                table: tables[versionsTable]
              })
            }
          }
        };
      }

      const doc: RawDoc | undefined = await queryTable.findFirst(params);

      if (!doc) {
        throw new RimeError(RimeError.OPERATION_ERROR);
      }

      return adapterUtil.mergeRawDocumentWithVersion(doc, versionsTable, select);
    }
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
    createArea,
    get
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

type Update = (args: {
  slug: AreaSlug;
  data: DeepPartial<GenericDoc>;
  locale?: string;
  /** Optional parameter to specify direct version update */
  versionId?: string;
  versionOperation: (typeof VERSIONS_OPERATIONS)[keyof typeof VERSIONS_OPERATIONS];
}) => Promise<{ id: string }>;
