import type { GetRegisterType } from '$lib/index.js';
import type { ColumnBaseConfig, ColumnDataType } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SQLiteColumn, SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { PrototypeSlug } from '../types.js';

// Basic types needed across multiple files
export type GenericAdapteFacadeArgs = {
  db: LibSQLDatabase<GetRegisterType<'Schema'>>;
  tables: GenericTables;
};

type GenericColumn = SQLiteColumn<
  ColumnBaseConfig<ColumnDataType, string>,
  Record<string, unknown>
>;
type GenericColumns = {
  [x: string]: GenericColumn;
};

export type GenericTable = SQLiteTableWithColumns<{
  columns: GenericColumns;
  dialect: string;
  name: string;
  schema: undefined;
}>;

export type GenericTables = Record<string, GenericTable | SQLiteTableWithColumns<any>>;

export type TableLocaleName = `${PrototypeSlug}Locales`;
