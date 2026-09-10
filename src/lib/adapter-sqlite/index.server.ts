import type { Adapter } from '$lib/core/adapter.js';
import type { Config } from '$lib/core/config/types.js';
import type { ConfigContext } from '$lib/core/rime.server.js';
import type { GetRegisterType } from '$lib/index.js';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import path from 'path';
import createAuthHandle from './auth.server.js';
import createBlocksHandle from './blocks.server.js';
import generateSchema from './generate-schema/index.server.js';
import type { RelationFieldsMap } from './generate-schema/root.server.js';
import { baseTableName } from './naming.server.js';
import { createPrototypeRegistry } from './registry.server.js';
import createRelationsHandle from './relations.server.js';
import { createTableHandles } from './table.server.js';
import { createTransformHandle } from './transform.server.js';
import createTreeHandle from './tree.server.js';
import type { GenericTable } from './types.server.js';

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
    relations: any;
    relationFieldsMap: any;
  };

  const dbPath = path.join(process.cwd(), 'db', database);
  // `relations`, not `schema`: a relational query resolves through the one `defineRelations`
  // block the generator emits. `tables` is still read straight off the module everywhere else.
  const db = drizzle('file:' + dbPath, { relations: schema.relations });
  const tables = schema.tables;

  // Two words, and each is the contract's own. `core/adapter.ts` declares `BlocksHandle`,
  // `TreeHandle`, `RelationsHandle`, `TransformHandle` and `AuthHandle` — one object of verbs
  // each — and `PrototypeHandle` / `TableHandle`, which are looked up by slug. The factories are
  // named for what they build, so a name here can be checked against a type there. It was three
  // words for the same idea: Facade, Registry and Handles.
  const blocks = createBlocksHandle({ db, tables });
  const tree = createTreeHandle({ db, tables });
  const relations = createRelationsHandle({ db, tables });
  const auth = createAuthHandle({
    db,
    schema: schema.default
  });
  const prototypes = createPrototypeRegistry({ db, tables, configCtx });
  const table = createTableHandles({ db, tables });
  const transform = createTransformHandle({
    tables,
    configCtx
  });

  return {
    ...prototypes,
    table,
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
      return tables[baseTableName(slug) as keyof typeof tables] as T extends any ? GenericTable : T;
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
  db: LibSQLDatabase<GetRegisterType<'Relations'>>;
  tables: GetRegisterType<'Tables'>;
  getTable<T>(key: string): T extends any ? GenericTable : T;
  tableForSlug<T>(slug: string): T extends any ? GenericTable : T;
  readonly schema: Schema;
  readonly relationFieldsMap: RelationFieldsMap;
};
