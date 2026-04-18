import { getRequestEvent } from '$app/server';
import {
  VERSIONS_OPERATIONS,
  VersionOperations
} from '$lib/core/collections/versions/operations.js';
import type { Config } from '$lib/core/config/types.js';
import { VERSIONS_STATUS } from '$lib/core/constant.js';
import { RimeError } from '$lib/core/errors/index.js';
import { withLocalesSuffix, withVersionsSuffix } from '$lib/core/naming.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { AreaSlug, GenericDoc, RawDoc } from '$lib/core/types/doc.js';
import type { GetRegisterType } from '$lib/index.js';
import { createBlankDocument } from '$lib/util/doc.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';
import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as adapterUtil from './util.js';
import { buildWithParam } from './with.js';

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

    const hasVersions = !!areaConfig.versions;

    if (!hasVersions) {
      const params = {
        columns: adapterUtil.columnsParams({ table: tables[slug], select }),
        with: buildWithParam({ slug, select, locale, tables, config: areaConfig }) || undefined
      };

      // @ts-expect-error slug is a tableName
      let doc = await db.query[slug].findFirst(params);

      if (!doc) {
        await createArea(slug, createBlankDocument(areaConfig, getRequestEvent()), locale);
        // @ts-expect-error slug is a tableName
        doc = await db.query[slug].findFirst(params);
      }
      if (!doc) {
        throw new Error('Database error');
      }
      return doc;
    } else {
      // First check for record presence
      // @ts-expect-error slug is a tableName
      const area = await db.query[slug].findFirst({ id: true });

      // If no area exists yet, create it
      if (!area) {
        await createArea(slug, createBlankDocument(areaConfig, getRequestEvent()), locale);
      }

      // Implementation for versioned areas
      const versionsTable = withVersionsSuffix(slug);
      const withParam = buildWithParam({
        slug: versionsTable,
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
      const rootSelectColumns = adapterUtil.columnsParams({ table: tables[slug], select });

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

      // @ts-expect-error slug is a tableName
      const doc = await db.query[slug].findFirst(params);

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
      const docId = await adapterUtil.insertTableRecord(db, tables, slug, {
        createdAt: now,
        updatedAt: now
      });

      // Generate version ID
      const versionsTableName = withVersionsSuffix(slug);

      // Prepare data for versions table
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(values, {
        tables,
        mainTableName: versionsTableName,
        localesTableName: withLocalesSuffix(versionsTableName),
        locale,
        fillNotNull: true
      });

      if (config.versions && config.versions.draft) {
        mainData.status = 'published';
      }

      // Insert version record
      const versionId = await adapterUtil.insertTableRecord(db, tables, versionsTableName, {
        ownerId: docId,
        ...mainData,
        createdAt: now,
        updatedAt: now
      });

      // Insert localized data if needed
      if (isLocalized && Object.keys(localizedData).length) {
        await adapterUtil.insertTableRecord(db, tables, withLocalesSuffix(versionsTableName), {
          ...localizedData,
          ownerId: versionId,
          locale: locale!
        });
      }

      // Return both IDs for versioned collections
      return {
        id: docId,
        versionId
      };
    } else {
      const tableLocales = withLocalesSuffix(slug);

      // Prepare data for insertion using the shared utility function
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(values, {
        tables,
        mainTableName: slug,
        localesTableName: tableLocales,
        locale,
        fillNotNull: true
      });

      // Insert main record
      const createId = await adapterUtil.insertTableRecord(db, tables, slug, {
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
    const now = new Date();
    const areaConfig = configCtx.areas[slug];

    const rows = await db.select({ id: tables[slug].id }).from(tables[slug]);
    const area = rows[0];

    // Simple update for non-versioned areas
    if (VersionOperations.isSimpleUpdate(versionOperation)) {
      // Original implementation for non-versioned areas
      const keyTableLocales = withLocalesSuffix(slug);
      // Prepare data for update using the shared utility function
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
        tables,
        mainTableName: slug,
        localesTableName: keyTableLocales,
        locale
      });

      // Update main table
      await adapterUtil.updateTableRecord(db, tables, slug, {
        recordId: area.id,
        data: { ...mainData, updatedAt: now }
      });

      // Update localized data if needed
      if (isLocalized) {
        await adapterUtil.upsertLocalizedData(db, tables, keyTableLocales, {
          ownerId: area.id,
          data: localizedData,
          locale: locale!
        });
      }

      // For non-versioned areas, versionId is the same as id
      return { id: area.id };
    } else if (VersionOperations.isSpecificVersionUpdate(versionOperation)) {
      // Scenario 1: Update a specific version directly
      if (!versionId) {
        throw new RimeError(RimeError.OPERATION_ERROR, 'missing versionId @adapter-update-area');
      }
      // First, update the root table's updatedAt
      await db
        .update(tables[slug])
        .set({
          updatedAt: now
        })
        .where(eq(tables[slug].id, area.id));

      const versionsTable = withVersionsSuffix(slug);
      const versionsLocalesTable = withLocalesSuffix(versionsTable);

      // Prepare data for update using the shared utility function
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
        tables,
        mainTableName: versionsTable,
        localesTableName: versionsLocalesTable,
        locale
      });
      // if draft is enabled on the collection
      if (areaConfig.versions && areaConfig.versions.draft && mainData.status === 'published') {
        // update all rows first to draft
        await db.update(tables[versionsTable]).set({ status: VERSIONS_STATUS.DRAFT });
      }
      // Update version directly
      await adapterUtil.updateTableRecord(db, tables, versionsTable, {
        recordId: versionId,
        data: { ...mainData, updatedAt: now }
      });
      // Update localized data if needed
      if (isLocalized) {
        await adapterUtil.upsertLocalizedData(db, tables, versionsLocalesTable, {
          ownerId: versionId,
          data: localizedData,
          locale: locale!
        });
      }

      return { id: area.id };
    } else if (VersionOperations.isNewVersionCreation(versionOperation)) {
      // Scenario 2: version creation, update only main table
      // the creation is handled by the caller update operation
      await db
        .update(tables[slug])
        .set({
          updatedAt: now
        })
        .where(eq(tables[slug].id, area.id));

      return { id: area.id };
    } else {
      throw new RimeError(RimeError.OPERATION_ERROR, 'Unhandled version operation');
    }
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
