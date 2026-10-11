import { createClient } from '@libsql/client';
import { defineRelations } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { text as textField } from '#lib/fields/index.js';
import { findManyPrototypes } from './read.server.js';

// `news`: its content on a versions table, a draft beside the published row.
const stamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
};
const news = sqliteTable('news', { id: text('id').primaryKey(), ...stamps });
const news__versions = sqliteTable('news__versions', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  status: text('status'),
  title: text('title'),
  ...stamps
});

const tables = { news, news__versions };

const relations = defineRelations(tables, (r) => ({
  news: {
    news__versions: r.many.news__versions({ from: r.news.id, to: r.news__versions.ownerId })
  },
  news__versions: { news: r.one.news({ from: r.news__versions.ownerId, to: r.news.id }) }
}));

const MIGRATION = [
  'CREATE TABLE `news` (`id` text PRIMARY KEY, `created_at` integer, `updated_at` integer)',
  'CREATE TABLE `news__versions` (`id` text PRIMARY KEY, `owner_id` text, `status` text, `title` text, `created_at` integer, `updated_at` integer)'
];

const config = { slug: 'news', fields: [textField('title'), textField('status')] } as never;
const configCtx = { raw: {}, getLocalesCodes: () => [] } as never;

let deps: { db: any; tables: any; configCtx: never };

/**
 * ```
 *       published   then a newer draft
 * a     Apple       Zebra
 * m     Mango
 * ```
 */
beforeAll(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'rime-read-')), 'test.sqlite');
  const client = createClient({ url: `file:${file}` });
  for (const statement of MIGRATION) await client.execute(statement);
  const db = drizzle({ client, relations });
  deps = { db, tables, configCtx };

  await db.insert(news).values([
    { id: 'a', createdAt: new Date(1), updatedAt: new Date(3) },
    { id: 'm', createdAt: new Date(2), updatedAt: new Date(2) }
  ]);
  await db.insert(news__versions).values([
    { id: 'a1', ownerId: 'a', status: 'published', title: 'Apple', updatedAt: new Date(1) },
    { id: 'm1', ownerId: 'm', status: 'published', title: 'Mango', updatedAt: new Date(2) },
    { id: 'a2', ownerId: 'a', status: 'draft', title: 'Zebra', updatedAt: new Date(3) }
  ]);
});

/** The titles of the news sorted by title, each read from the row `content` picks. */
const titlesSorted = async (content?: object) => {
  const docs = await findManyPrototypes(deps, {
    slug: 'news',
    versions: { slug: '$news__versions' } as never,
    sort: 'title',
    content: content as never,
    config
  });
  return docs.map((doc) => doc.title);
};

describe('a versioned list sorted on a content field', () => {
  test('the published read is ordered by the published titles', async () => {
    expect(await titlesSorted({ where: { status: { equals: 'published' } } })).toEqual([
      'Apple',
      'Mango'
    ]);
  });

  test('the latest read is ordered by the newest titles', async () => {
    expect(await titlesSorted()).toEqual(['Mango', 'Zebra']);
  });

  test('an offset that is not a number is none', async () => {
    const docs = await findManyPrototypes(deps, {
      slug: 'news',
      versions: { slug: '$news__versions' } as never,
      sort: 'title',
      offset: NaN,
      config
    });
    expect(docs.map((doc) => doc.title)).toEqual(['Mango', 'Zebra']);
  });

  test('an offset skips that many documents', async () => {
    const docs = await findManyPrototypes(deps, {
      slug: 'news',
      versions: { slug: '$news__versions' } as never,
      sort: 'title',
      offset: 1,
      config
    });
    expect(docs.map((doc) => doc.title)).toEqual(['Zebra']);
  });
});
