import type { Adapter, UpdateDocumentUrlParams } from '$lib/core/adapter/types.js';
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
  createAdapter: <C extends Config>(configCtx: ConfigContext<C>) => Promise<SqliteAdapter>;
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
}): Promise<SqliteAdapter> => {
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
     * Part of the escape hatch, not of the Adapter contract: core asks for documents by slug
     * and never for the table they sit in.
     */
    tableForSlug<T>(slug: string) {
      return tables[baseTableName(slug) as keyof typeof tables] as T extends any
        ? GenericTable
        : T;
    },

    async updateRecord(id: string, tableName: string, data: Dic) {
      return await updateTableRecord(db, tables, tableName, { recordId: id, data });
    },

    async updateDocumentUrl(url: string, params: UpdateDocumentUrlParams) {
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

/**
 * Everything this adapter offers: the `Adapter` contract core programs against, plus the
 * SQL-specific escape hatch it exposes on top.
 *
 * The split is the point. `Adapter` lives in core and is written in core's vocabulary; the
 * members below are things only a SQL adapter can honour, and no core code may use them —
 * `rime.adapter.db` is documented for *consumers* who need to drop to drizzle.
 *
 * `createAdapter`'s return type is checked against `Adapter` where it is declared, so a facade
 * that drifts from the contract is a build error rather than a runtime surprise.
 */
export type SqliteAdapter = Adapter & {
  db: LibSQLDatabase<Schema>;
  tables: GetRegisterType<'Tables'>;
  getTable<T>(key: string): T extends any ? GenericTable : T;
  tableForSlug<T>(slug: string): T extends any ? GenericTable : T;
  readonly schema: Schema;
  readonly relationFieldsMap: RelationFieldsMap;
};
