import type { GetRegisterType } from '#lib/index.js';
import type { ColumnBaseConfig, ColumnDataType } from 'drizzle-orm';
import type {
  SQLiteAsyncDatabase,
  SQLiteColumn,
  SQLiteTableWithColumns
} from 'drizzle-orm/sqlite-core';

/**
 * The drizzle connection, whichever driver opened it.
 *
 * libsql is async and bun:sqlite is sync, but drizzle wraps both in `SQLiteAsyncDatabase`, so
 * every query is awaited the same way. The one difference that leaks: a sync driver commits when
 * the `db.transaction()` callback returns, so that callback must not await. Run several writes as
 * one with `inTransaction` (transaction.server.ts).
 */
export type SqliteDatabase = SQLiteAsyncDatabase<
  'sync' | 'async',
  unknown,
  GetRegisterType<'Relations'>
>;

/**
 * What every handle in this folder is built from: the connection and the generated tables.
 */
export type AdapterDeps = {
  db: SqliteDatabase;
  tables: GenericTables;
};

type GenericColumn = SQLiteColumn<ColumnBaseConfig<ColumnDataType>, Record<string, unknown>>;
type GenericColumns = {
  [x: string]: GenericColumn;
};

export type GenericTable = SQLiteTableWithColumns<{
  columns: GenericColumns;
  dialect: string;
  name: string;
  schema: undefined;
}>;

type GenericTables = Record<string, GenericTable | SQLiteTableWithColumns<any>>;
