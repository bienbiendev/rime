import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import createRelationsHandle from './relations.server.js';

// The tables as the schema generator writes them, and their migration as drizzle-kit generates it.
const pages = sqliteTable('pages', { id: text('id').primaryKey() });
const medias = sqliteTable('medias', { id: text('id').primaryKey() });
const relations = sqliteTable('pages__$relations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  path: text('path'),
  position: integer('position'),
  ownerId: text('owner_id').references(() => pages.id, { onDelete: 'cascade' }),
  mediasId: text('medias_id').references(() => medias.id, { onDelete: 'cascade' })
});

const MIGRATION = [
  'PRAGMA foreign_keys = ON',
  'CREATE TABLE `pages` (`id` text PRIMARY KEY)',
  'CREATE TABLE `medias` (`id` text PRIMARY KEY)',
  `CREATE TABLE \`pages__$relations\` (
    \`id\` text PRIMARY KEY,
    \`path\` text,
    \`position\` integer,
    \`owner_id\` text,
    \`medias_id\` text,
    FOREIGN KEY (\`owner_id\`) REFERENCES \`pages\`(\`id\`) ON DELETE CASCADE,
    FOREIGN KEY (\`medias_id\`) REFERENCES \`medias\`(\`id\`) ON DELETE CASCADE
  )`
];

let handle: ReturnType<typeof createRelationsHandle>;
let db: ReturnType<typeof drizzle>;
const parentSlug = 'pages' as never;
const ownerId = 'p1';

const link = (path: string, documentId: string, position = 0) => ({
  path,
  position,
  relationTo: 'medias',
  documentId
});

const pathsLeft = async () =>
  (await handle.getAll({ parentSlug, ownerId })).map((row) => row.path).sort();

beforeEach(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'rime-relations-')), 'test.sqlite');
  const client = createClient({ url: `file:${file}` });
  for (const statement of MIGRATION) await client.execute(statement);
  db = drizzle({ client });
  handle = createRelationsHandle({
    db: db as any,
    tables: { pages, medias, pages__$relations: relations } as any
  });
  await db.insert(pages).values({ id: ownerId });
  await db.insert(medias).values(['m1', 'm2', 'm3'].map((id) => ({ id })));
});

describe('deleteFromPaths', () => {
  test('deleting block 1 keeps the relations of block 10', async () => {
    await handle.create({
      parentSlug,
      ownerId,
      relations: [
        link('sections.1.image', 'm1'),
        link('sections.10.image', 'm2'),
        link('sections.12.image', 'm3')
      ]
    });

    await handle.deleteFromPaths({ parentSlug, ownerId, paths: ['sections.1'] });

    expect(await pathsLeft()).toEqual(['sections.10.image', 'sections.12.image']);
  });

  test('deletes the relations nested in the block, through a group', async () => {
    await handle.create({
      parentSlug,
      ownerId,
      relations: [link('sections.1.media.image', 'm1'), link('sections.2.image', 'm2')]
    });

    await handle.deleteFromPaths({ parentSlug, ownerId, paths: ['sections.1'] });

    expect(await pathsLeft()).toEqual(['sections.2.image']);
  });
});

describe('create', () => {
  test('a document that does not exist fails the write, it is not skipped', async () => {
    await expect(
      handle.create({
        parentSlug,
        ownerId,
        relations: [link('image', 'm1'), link('gallery', 'gone'), link('cover', 'm2')]
      })
    ).rejects.toThrow(/relations create failed at gallery/);
  });
});

describe('missing', () => {
  test('the ids that name no document, in one query', async () => {
    expect(
      await handle.missing({ relationTo: 'medias' as never, ids: ['m1', 'gone', 'm3', 'lost'] })
    ).toEqual(['gone', 'lost']);
  });

  test('nothing asked, nothing missing', async () => {
    expect(await handle.missing({ relationTo: 'medias' as never, ids: [] })).toEqual([]);
  });

  test('a target with no table: every id is missing', async () => {
    expect(await handle.missing({ relationTo: 'nowhere' as never, ids: ['m1'] })).toEqual(['m1']);
  });
});
