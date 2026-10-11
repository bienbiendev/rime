import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { createTableHandles } from './table.server.js';

// A declared table, `$authUsers`: one user banned, one not banned yet
const authUsers = sqliteTable('authUsers', {
  id: text('id').primaryKey(),
  name: text('name'),
  banned: integer('banned', { mode: 'boolean' })
});

let handle: ReturnType<ReturnType<typeof createTableHandles>>;

beforeAll(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'rime-table-')), 'test.sqlite');
  const client = createClient({ url: `file:${file}` });
  await client.execute(
    'CREATE TABLE `authUsers` (`id` text PRIMARY KEY, `name` text, `banned` integer)'
  );
  const db = drizzle({ client });
  await db.insert(authUsers).values([
    { id: 'u1', name: 'Ann', banned: true },
    { id: 'u2', name: 'Bob', banned: null }
  ]);
  handle = createTableHandles({ db: db as never, tables: { authUsers } as never })('$authUsers');
});

describe('a declared table handle', () => {
  test('a null value finds the rows holding none', async () => {
    expect(await handle.find({ where: { banned: null } })).toEqual([
      { id: 'u2', name: 'Bob', banned: null }
    ]);
  });

  test('selects the columns it is handed', async () => {
    expect(await handle.find({ where: { id: 'u1' }, select: ['name'] })).toEqual([{ name: 'Ann' }]);
  });

  test('refuses a column the table does not have, in a filter or a select', async () => {
    await expect(handle.find({ where: { nope: 1 } })).rejects.toThrow(
      '"$authUsers" has no column "nope"'
    );
    await expect(handle.find({ select: ['nope'] })).rejects.toThrow(
      '"$authUsers" has no column "nope"'
    );
  });
});
