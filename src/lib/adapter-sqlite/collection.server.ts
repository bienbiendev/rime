import { getSegments } from '$lib/core/features/upload/util/path.js';
import { VERSIONS_OPERATIONS } from '$lib/core/features/versions/strategy.js';
import type { Config } from '$lib/core/factory/config/types.js';
import { withDirectoriesSuffix } from '$lib/core/features/upload/naming.js';
import { withVersionsSuffix } from '$lib/core/features/versions/naming.js';
import type { ConfigContext } from '$lib/core/rime/index.server.js';
import type { CollectionSlug, GenericDoc, RawDoc } from '$lib/core/prototype/types.js';
import type { OperationQuery } from '$lib/core/operations/types.js';
import type { GetRegisterType } from '$lib/index.js';
import { trycatchSync } from '$lib/util/function.js';
import type { DeepPartial, Dic } from '$lib/util/types.js';
import { and, desc, eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { RimeError } from '../core/errors/index.js';
import { buildOrderByParam } from './orderBy.server.js';
import * as adapterUtil from './util.server.js';
import { buildWhereParam } from './where.server.js';
import { buildWithParam } from './with.server.js';
import { baseTableName, tableName as buildTableName } from './naming.server.js';
import { insertRowWithLocales, readPrototype, updatePrototype } from './prototype.server.js';
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
  const findById: FindById = async ({ slug, id, versionId, select, locale, draft }) => {
    const doc = await readPrototype(
      { db, tables },
      { slug, id, versionId, select, locale, draft, config: configCtx.collections[slug] }
    );

    if (!doc) throw new RimeError(RimeError.NOT_FOUND);

    return doc as RawDoc;
  };

  /**
   * Deletes a document by its ID from a collection. For versioned collections,
   * removes the root document and all its versions.
   */
  const deleteById: DeleteById = async ({ slug, id }) => {
    const docs = await db.delete(tables[baseTableName(slug)]).where(eq(tables[baseTableName(slug)].id, id)).returning();
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
      const docId = await adapterUtil.insertTableRecord(db, tables, baseTableName(slug), {
        createdAt: now,
        updatedAt: now,
        ...rootData
      });

      const versionsTableName = baseTableName(withVersionsSuffix(slug));

      // Prepare data for versions table
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(contentData, {
        tables,
        mainTableName: versionsTableName,
        localesTableName: buildTableName({ owner: versionsTableName, branch: 'locales' }),
        locale
      });

      const versionId = await insertRowWithLocales(
        { db, tables },
        {
          table: versionsTableName,
          row: { id: adapterUtil.generatePK(), ownerId: docId, ...mainData },
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
      // Generate document ID
      const docId = data.id || adapterUtil.generatePK();

      // Prepare data for main table
      const { mainData, localizedData, isLocalized } = adapterUtil.prepareSchemaData(data, {
        tables,
        mainTableName: baseTableName(slug),
        localesTableName: buildTableName({ owner: baseTableName(slug), branch: 'locales' }),
        locale
      });

      await insertRowWithLocales(
        { db, tables },
        {
          table: baseTableName(slug),
          row: { id: docId, ...mainData },
          now,
          localized: { data: localizedData, isLocalized, locale }
        }
      );

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
  const update: Update = async ({ slug, id, versionId, data, locale, versionOperation }) =>
    updatePrototype(
      { db, tables },
      { slug, id, versionId, data, locale, versionOperation, config: configCtx.collections[slug] }
    );

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
        with: buildWithParam({ table: baseTableName(slug), select, tables, config, locale }) || undefined,
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
      const selectColumns = adapterUtil.columnsParams({ table: tables[baseTableName(slug)], select });

      //@ts-expect-error slug is a table for sure
      return await db.query[baseTableName(slug)].findMany({
        columns: selectColumns,
        ...params
      });
    } else {
      // Implementation for versioned collections
      // Two different things, and they stopped being the same string when the naming convention
      // changed: buildWithParam reads the schema, so it takes a table name; buildWhereParam
      // resolves fields against the config, so it takes a slug. They share a parameter name.
      const versionsSlug = withVersionsSuffix(slug);
      const versionsTable = baseTableName(versionsSlug);
      const withParam =
        buildWithParam({ table: versionsTable, select, tables, config, locale }) || undefined;

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
        ? buildWhereParam({ query, slug: versionsSlug, locale, db, configCtx, tables })
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
      const rootSelectColumns = adapterUtil.columnsParams({ table: tables[baseTableName(slug)], select });

      //@ts-expect-error slug is a table for sure
      const rawDocs = await db.query[baseTableName(slug)].findMany({
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
