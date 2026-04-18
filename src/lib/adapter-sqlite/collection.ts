import { getSegments } from '$lib/core/collections/upload/util/path.js';
import {
  VERSIONS_OPERATIONS,
  VersionOperations
} from '$lib/core/collections/versions/operations.js';
import type { Config } from '$lib/core/config/types.js';
import { VERSIONS_STATUS } from '$lib/core/constant.js';
import { withDirectoriesSuffix, withLocalesSuffix, withVersionsSuffix } from '$lib/core/naming.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { CollectionSlug, GenericDoc, RawDoc } from '$lib/core/types/doc.js';
import type { OperationQuery } from '$lib/core/types/index.js';
import type { GetRegisterType } from '$lib/index.js';
import { trycatchSync } from '$lib/util/function.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';
import { and, desc, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { RimeError } from '../core/errors/index.js';
import { buildOrderByParam } from './orderBy.js';
import * as adapterUtil from './util.js';
import { buildWhereParam } from './where.js';
import { buildWithParam } from './with.js';
type Schema = GetRegisterType<'Schema'>;

/**
 * Creates a collection facade for SQLite adapter operations with CRUD functionality.
 * Handles both versioned and non-versioned collections with support for localization.
 */
const createCollectionFacade = <const C extends Config>(args: {
  db: LibSQLDatabase<Schema>;
  tables: any;
  configCtx: ConfigContext<C>;
}) => {
  const { db, tables, configCtx } = args;

  /**
   * Retrieves a document by its ID from a collection. For versioned collections,
   * returns either a specific version (if versionId is provided) or the latest/published version.
   */
  const findById: FindById = async ({ slug, id, versionId, locale, draft }) => {
    const config = configCtx.collections[slug];
    const isVersioned = !!config.versions;
    const table = tables[slug];

    if (!isVersioned) {
      // Original implementation for non-versioned collections
      const withParam = buildWithParam({ slug, locale, tables, config });
      //@ts-expect-error slug is a table for sure
      const doc = await db.query[slug].findFirst({
        where: eq(table.id, id),
        with: withParam
      });

      if (!doc) {
        throw new RimeError(RimeError.NOT_FOUND);
      }

      return doc;
    } else {
      // Implementation for versioned collections
      const versionsTable = withVersionsSuffix(slug);
      const withParam = buildWithParam({ slug: versionsTable, locale, tables, config });

      // Build params based
      // if version Id get the specifi version
      // else get the published or the latest, depending on the draft param
      const params = {
        where: eq(table.id, id),
        with: {
          [versionsTable]: {
            with: withParam,
            ...(versionId
              ? {
                  where: eq(tables[versionsTable].id, versionId)
                }
              : adapterUtil.buildPublishedOrLatestVersionParams({
                  draft,
                  config,
                  table: tables[versionsTable]
                }))
          }
        }
      };

      //@ts-expect-error slug is a table for sure
      const doc = await db.query[slug].findFirst(params);

      // Throw 404 if not found
      // If we found the document but there are no versions, that's also a 404
      if (!doc || !doc[versionsTable] || doc[versionsTable].length === 0) {
        throw new RimeError(RimeError.NOT_FOUND);
      }

      return adapterUtil.mergeRawDocumentWithVersion(doc, versionsTable);
    }
  };

  /**
   * Deletes a document by its ID from a collection. For versioned collections,
   * removes the root document and all its versions.
   */
  const deleteById: DeleteById = async ({ slug, id }) => {
    const docs = await db.delete(tables[slug]).where(eq(tables[slug].id, id)).returning();
    if (!docs || !Array.isArray(docs) || !docs.length) {
      throw new RimeError(RimeError.NOT_FOUND);
    }
    return docs[0].id;
  };

  /**
   * Creates a new document in a collection. For versioned collections, creates both
   * the root document and its first version. For non-versioned collections, creates
   * a single document with the provided data.
   */
  const insert: Insert = async ({ slug, data, locale }) => {
    const config = configCtx.collections[slug];
    const isVersioned = !!config.versions;
    const now = new Date();

    if (config.upload) {
      // Get path segments
      const [error, segments] = trycatchSync(() => getSegments(data._path));
      if (error) {
        throw new RimeError(RimeError.BAD_REQUEST, error.message);
      }
      const { path, name, parent } = segments;
      // set the normailzed path for the reference in the upload table
      data._path = path;
      // Get relative directory collection table
      const tableName = withDirectoriesSuffix(slug);
      const table = tables[tableName];

      // Check if there is already a folder with the path in the uploadDirectories
      //@ts-expect-error tableName is a table for sure
      const uploadDir = await db.query[tableName].findFirst({
        where: and(eq(table.id, data._path))
      });

      if (!uploadDir) {
        await db.insert(table).values({
          id: data._path,
          parent,
          name,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (isVersioned) {
      // Extract root props (_parent, _position, _path) from data
      const { data: contentData, rootData } = adapterUtil.extractRootData(data);

      // Create root document with hierarchy/upload root props
      const docId = await adapterUtil.insertTableRecord(db, tables, slug, {
        createdAt: now,
        updatedAt: now,
        ...rootData
      });

      // Generate version ID
      const versionId = adapterUtil.generatePK();
      const versionsTableName = withVersionsSuffix(slug);

      // Prepare data for versions table
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(contentData, {
        tables,
        mainTableName: versionsTableName,
        localesTableName: withLocalesSuffix(versionsTableName),
        locale
      });

      // Insert version record
      await adapterUtil.insertTableRecord(db, tables, versionsTableName, {
        id: versionId,
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
      // Generate document ID
      const docId = data.id || adapterUtil.generatePK();

      // Prepare data for main table
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
        tables,
        mainTableName: slug,
        localesTableName: withLocalesSuffix(slug),
        locale
      });

      // Insert main record
      await adapterUtil.insertTableRecord(db, tables, slug, {
        id: docId,
        ...mainData,
        createdAt: now,
        updatedAt: now
      });

      // Insert localized data if needed
      if (isLocalized && Object.keys(localizedData).length) {
        await adapterUtil.insertTableRecord(db, tables, withLocalesSuffix(slug), {
          ...localizedData,
          ownerId: docId,
          locale: locale!
        });
      }

      // For non-versioned collections, id and versionId are the same
      return {
        id: docId,
        versionId: docId
      };
    }
  };

  /**
   * Updates a document in a collection using different versioning strategies.
   * Supports multiple update patterns:
   * - Simple update for non-versioned collections
   * - Direct version update for versioned collections
   * - Creating new versions from existing ones
   * - Publishing draft versions
   */
  const update: Update = async ({ slug, id, versionId, data, locale, versionOperation }) => {
    const now = new Date();
    const config = configCtx.collections[slug];

    if (VersionOperations.isSimpleUpdate(versionOperation)) {
      // Scenario 0: Non-versioned collections
      const tableName = slug;
      const tableLocalesName = withLocalesSuffix(slug);

      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
        tables,
        mainTableName: tableName,
        localesTableName: tableLocalesName,
        locale
      });

      // Update main table
      await adapterUtil.updateTableRecord(db, tables, tableName, {
        recordId: id,
        data: { ...mainData, updatedAt: now }
      });

      // Update locales table if needed
      if (isLocalized) {
        await adapterUtil.upsertLocalizedData(db, tables, tableLocalesName, {
          ownerId: id,
          data: localizedData,
          locale: locale!
        });
      }
      return { id: data.id || id };
    } else if (VersionOperations.isSpecificVersionUpdate(versionOperation)) {
      // Scenario 1: Upadte specific version
      if (!versionId) {
        throw new RimeError(
          RimeError.OPERATION_ERROR,
          'missing versionId @adapter-update-collection'
        );
      }

      // Extract hierarchy fields (_parent, _position) from data
      const { data: contentData, rootData } = adapterUtil.extractRootData(data);

      // Update the root table with updatedAt and any hierarchy fields
      await adapterUtil.updateTableRecord(db, tables, slug, {
        recordId: id,
        data: {
          updatedAt: now,
          ...rootData
        }
      });

      const versionsTable = withVersionsSuffix(slug);
      const versionsLocalesTable = withLocalesSuffix(versionsTable);

      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(contentData, {
        tables,
        mainTableName: versionsTable,
        localesTableName: versionsLocalesTable,
        locale
      });

      // if draft is enabled on the collection
      if (config.versions && config.versions.draft && mainData.status === 'published') {
        // update all rows first to draft
        await db
          .update(tables[versionsTable])
          .set({ status: VERSIONS_STATUS.DRAFT })
          .where(eq(tables[versionsTable].ownerId, id));
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

      return { id: data.id || id };
    } else if (VersionOperations.isNewVersionCreation(versionOperation)) {
      // Scenario 2: Version creation
      // The creation is handled by the caller operation updateById
      // so only update the the root table

      // Extract hierarchy fields (_parent, _position) from data
      const { rootData } = adapterUtil.extractRootData(data);

      // 2. Get possible hierarchy data update only the root table
      await adapterUtil.updateTableRecord(db, tables, slug, {
        recordId: id,
        data: { updatedAt: now, ...rootData }
      });

      return { id: data.id || id };
    } else {
      throw new RimeError(RimeError.OPERATION_ERROR, 'Unhandled version operation');
    }
  };

  /**
   * Finds documents in a collection with support for filtering, sorting, pagination,
   * field selection, and localization. For versioned collections, returns the latest
   * or published version of each document.
   */
  const find: FindDocuments = async ({
    slug,
    select,
    query: incomingQuery,
    sort,
    limit,
    offset,
    locale,
    draft
  }) => {
    const config = configCtx.collections[slug];
    const isVersioned = !!config.versions;

    let query = incomingQuery ? adapterUtil.normalizeQuery(incomingQuery) : undefined;

    if (!isVersioned) {
      // Original implementation for non-versioned collections
      const params: Dic = {
        with: buildWithParam({ slug, select, tables, config, locale }) || undefined,
        orderBy: buildOrderByParam({ slug, locale, tables, config, by: sort }),
        // Set a sufficient limit when offset is set but not limit as sqlite requires limit if offset present
        limit: limit || (typeof offset === 'number' ? 1000000 : undefined),
        offset: offset || undefined
      };

      if (query) {
        params.where = buildWhereParam({ query, slug, locale, db, configCtx, tables });
      }

      // Remove undefined properties
      Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);
      const selectColumns = adapterUtil.columnsParams({ table: tables[slug], select });

      //@ts-expect-error slug is a table for sure
      return await db.query[slug].findMany({
        columns: selectColumns,
        ...params
      });
    } else {
      // Implementation for versioned collections
      const versionsTable = withVersionsSuffix(slug);
      const withParam =
        buildWithParam({ slug: versionsTable, select, tables, config, locale }) || undefined;

      // If draft is not true and versions.draft enabled
      // Then we adjust the query to get the published document
      if (!draft && config.versions && config.versions.draft) {
        if (!query) {
          query = { where: { status: { equals: 'published' } } };
        } else {
          const originalWhere = { ...query.where };
          if ('and' in originalWhere && Array.isArray(originalWhere.and)) {
            query = {
              where: {
                ...originalWhere,
                and: [...originalWhere.and, { status: { equals: 'published' } }]
              }
            };
          } else {
            query = {
              where: {
                and: [originalWhere, { status: { equals: 'published' } }]
              }
            };
          }
        }
      }

      const whereParam = query
        ? buildWhereParam({ query, slug: versionsTable, locale, db, configCtx, tables })
        : undefined;

      // Build the query parameters for pagination and sorting of the root table
      const params: Dic = {
        // Set a sufficient limit when offset is set but limit doesn't, because sqlite requires limit if offset present
        limit: limit || (typeof offset === 'number' ? 1000000 : undefined),
        offset: offset,
        orderBy: buildOrderByParam({ slug, locale, tables, config, by: sort })
      };

      // Remove undefined properties
      Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

      // Handle select columns for version table
      const versionSelectColumns = adapterUtil.columnsParams({
        table: tables[versionsTable],
        select
      });
      // Handle select columns for root table
      const rootSelectColumns = adapterUtil.columnsParams({ table: tables[slug], select });

      //@ts-expect-error slug is a table for sure
      const rawDocs = await db.query[slug].findMany({
        ...params,
        columns: rootSelectColumns,
        with: {
          [versionsTable]: {
            with: withParam,
            where: whereParam,
            orderBy: [desc(tables[versionsTable].updatedAt)],
            limit: 1,
            columns: versionSelectColumns
          }
        }
      });

      // Transform the results to include version data for eaach document
      const result = rawDocs
        .map((doc: RawDoc) => {
          // for documents that have no version
          try {
            return adapterUtil.mergeRawDocumentWithVersion(doc, versionsTable, select);
          } catch (err: any) {
            // In case there is no version data, for exemple when a query
            // forwarded to the versions table returns no result
            // catch the error and return false
            if (err instanceof RimeError && err.code === RimeError.NOT_FOUND) {
              return false;
            }
            // Else throw the error
            throw err;
          }
        })
        .filter(Boolean);

      return result;
    }
  };

  return {
    findById,
    deleteById,
    insert,
    update,
    find
  };
};

export default createCollectionFacade;

type FindDocuments = (args: {
  slug: CollectionSlug;
  select?: string[];
  query?: OperationQuery;
  sort?: string;
  limit?: number;
  offset?: number;
  locale?: string;
  /** Allow draft documents to be retrieved */
  draft?: boolean;
}) => Promise<RawDoc[]>;

type FindById = (args: {
  slug: CollectionSlug;
  id: string;
  /** Optional parameter to get a specific version */
  versionId?: string;
  locale?: string;
  select?: string[];
  /** Allow draft documents to be retrieved */
  draft?: boolean;
}) => Promise<RawDoc>;

type DeleteById = (args: { slug: CollectionSlug; id: string }) => Promise<string | undefined>;

type Insert = (args: {
  slug: CollectionSlug;
  data: DeepPartial<GenericDoc>;
  locale?: string;
}) => Promise<{ id: string; versionId: string }>;

type Update = (args: {
  slug: CollectionSlug;
  id: string;
  /** Optional parameter to specify direct version update */
  versionId?: string;
  versionOperation: (typeof VERSIONS_OPERATIONS)[keyof typeof VERSIONS_OPERATIONS];
  data: DeepPartial<GenericDoc>;
  locale?: string;
}) => Promise<{ id: string }>;
