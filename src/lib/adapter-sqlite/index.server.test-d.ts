import { expectTypeOf, test } from 'vitest';
import type { SqliteAdapter } from './index.server.js';
import type { GenericTable } from './types.server.js';

/** Any table type a caller names. */
type Notes = { notes: true };

declare const adapter: SqliteAdapter;

test('getTable and tableForSlug answer the table type asked for', () => {
  expectTypeOf(adapter.getTable<Notes>('notes')).toEqualTypeOf<Notes>();
  expectTypeOf(adapter.tableForSlug<Notes>('notes')).toEqualTypeOf<Notes>();
});

test('without a type, a generic table', () => {
  expectTypeOf(adapter.getTable('notes')).toEqualTypeOf<GenericTable>();
});
