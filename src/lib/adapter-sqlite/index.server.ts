import type { Config } from '$lib/core/factory/config/types.js';
import type { ConfigContext } from '$lib/core/rime/index.server.js';
import type { GetRegisterType } from '$lib/index.js';
import type { Dic } from '$lib/util/types.js';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import path from 'path';
import createAreaFacade from './area.server.js';
import createAuthFacade from './auth.server.js';
import createBlocksFacade from './blocks.server.js';
import createCollectionFacade from './collection.server.js';
import generateSchema from './generate-schema/index.server.js';
import type { RelationFieldsMap } from './generate-schema/relations/definition.server.js';
import createRelationsFacade from './relations.server.js';
import { transformerFacade } from './transform.server.js';
import createTreeFacade from './tree.server.js';
import type { GenericTable } from './types.server.js';
import { updateDocumentUrl } from './url.server.js';
import { baseTableName } from './naming.server.js';
import { updateTableRecord } from './util.server.js';

type Schema = GetRegisterType<'Schema'>;
type Tables = GetRegisterType<'Tables'>;

export function adapterSqlite(database: string): {
  createAdapter: <C extends Config>(configCtx: ConfigContext<C>) => Promise<Adapter>;
  generateSchema: typeof generateSchema;
} {
  //
  return {
    createAdapter: <C extends Config>(configCtx: ConfigContext<C>) =>
      createAdapter({ database, configCtx }),
    generateSchema
  };
}

const createAdapter = async <const C extends Config>(args: {
  database: string;
  configCtx: ConfigContext<C>;
}) => {
  const { database, configCtx } = args;

  const schema = (await import('$rime/schema')) as {
    tables: Tables;
    default: Schema;
    relationFieldsMap: any;
  };

  const dbPath = path.join(process.cwd(), 'db', database);
  const db = drizzle('file:' + dbPath, { schema: schema.default });
  const tables = schema.tables;

  const blocks = createBlocksFacade({ db, tables });
  const tree = createTreeFacade({ db, tables });
  const relations = createRelationsFacade({ db, tables });
  const auth = createAuthFacade({
    db,
    schema: schema.default
  });
  const collection = createCollectionFacade({
    db,
    tables,
    configCtx
  });
  const area = createAreaFacade({
    db,
    tables,
    configCtx
  });
  const transform = transformerFacade({
    tables,
    configCtx
  });

  return {
    collection,
    area,
    blocks,
    tree,
    relations,
    transform,
    auth,
    db,
    tables: tables as GetRegisterType<'Tables'>,

    getTable<T>(key: string) {
      return tables[key as keyof typeof tables] as T extends any ? GenericTable : T;
    },

    /**
     * The table holding a *prototype's* rows, by slug.
     *
     * Distinct from getTable, which takes a table name already computed. Core code has no
     * business knowing table names, so this is what it calls — it used to reach into
     * `adapter.tables[slug]` directly, which only worked because a slug and a table name are
     * currently the same string.
     */
    tableForSlug<T>(slug: string) {
      return tables[baseTableName(slug) as keyof typeof tables] as T extends any
        ? GenericTable
        : T;
    },

    async updateRecord(id: string, tableName: string, data: Dic) {
      return await updateTableRecord(db, tables, tableName, { recordId: id, data });
    },

    async updateDocumentUrl(
      url: string,
      params: Omit<Parameters<typeof updateDocumentUrl>[1], 'db' | 'tables'>
    ) {
      return await updateDocumentUrl(url, {
        ...params,
        db,
        tables
      });
    },

    get schema() {
      return schema.default;
    },

    get relationFieldsMap() {
      return schema.relationFieldsMap;
    }
  };
};

export type Adapter = {
  collection: ReturnType<typeof createCollectionFacade>;
  area: ReturnType<typeof createAreaFacade>;
  blocks: ReturnType<typeof createBlocksFacade>;
  tree: ReturnType<typeof createTreeFacade>;
  relations: ReturnType<typeof createRelationsFacade>;
  transform: ReturnType<typeof transformerFacade>;
  auth: ReturnType<typeof createAuthFacade>;
  db: LibSQLDatabase<Schema>;
  tables: GetRegisterType<'Tables'>;
  getTable<T>(key: string): T extends any ? GenericTable : T;
  tableForSlug<T>(slug: string): T extends any ? GenericTable : T;
  updateRecord(
    id: string,
    tableName: string,
    data: Dic
  ): Awaited<ReturnType<typeof updateTableRecord>>;
  updateDocumentUrl: (
    url: string,
    params: Omit<Parameters<typeof updateDocumentUrl>[1], 'db' | 'tables'>
  ) => Promise<void>;
  readonly schema: Schema;
  readonly relationFieldsMap: RelationFieldsMap;
};
