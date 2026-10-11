import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildOrderByParam } from './order-by.server.js';
import type { GenericTable } from './types.server.js';

// Two versioned collections: `news` keeps its title on the versions table, `pages` in the
// versions table's locales branch.
const news = sqliteTable('news', { id: text('id').primaryKey() });
const news__versions = sqliteTable('news__versions', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  status: text('status'),
  title: text('title'),
  updatedAt: integer('updated_at')
});
const pages = sqliteTable('pages', { id: text('id').primaryKey() });
const pages__versions = sqliteTable('pages__versions', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  status: text('status'),
  updatedAt: integer('updated_at')
});
const pages__versions__$$locales = sqliteTable('pages__versions__$$locales', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  locale: text('locale'),
  title: text('title')
});

const tables = { news, news__versions, pages, pages__versions, pages__versions__$$locales };

const MIGRATION = [
  'CREATE TABLE `news` (`id` text PRIMARY KEY)',
  'CREATE TABLE `news__versions` (`id` text PRIMARY KEY, `owner_id` text, `status` text, `title` text, `updated_at` integer)',
  'CREATE TABLE `pages` (`id` text PRIMARY KEY)',
  'CREATE TABLE `pages__versions` (`id` text PRIMARY KEY, `owner_id` text, `status` text, `updated_at` integer)',
  'CREATE TABLE `pages__versions__$$locales` (`id` text PRIMARY KEY, `owner_id` text, `locale` text, `title` text)'
];

const configCtx = {
  raw: { localization: { locales: [{ code: 'en' }], default: 'en' } },
  getLocalesCodes: () => ['en']
} as never;

let db: ReturnType<typeof drizzle>;

/**
 * ```
 *       published   then a newer draft
 * a     Apple       Zebra
 * m     Mango
 * ```
 *
 * The same rows for `news` and for `pages`.
 */
beforeAll(async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'rime-order-by-')), 'test.sqlite');
  const client = createClient({ url: `file:${file}` });
  for (const statement of MIGRATION) await client.execute(statement);
  db = drizzle({ client });

  await db.insert(news).values([{ id: 'a' }, { id: 'm' }]);
  await db.insert(news__versions).values([
    { id: 'a1', ownerId: 'a', status: 'published', title: 'Apple', updatedAt: 1 },
    { id: 'm1', ownerId: 'm', status: 'published', title: 'Mango', updatedAt: 2 },
    { id: 'a2', ownerId: 'a', status: 'draft', title: 'Zebra', updatedAt: 3 }
  ]);
  await db.insert(pages).values([{ id: 'a' }, { id: 'm' }]);
  await db.insert(pages__versions).values([
    { id: 'a1', ownerId: 'a', status: 'published', updatedAt: 1 },
    { id: 'm1', ownerId: 'm', status: 'published', updatedAt: 2 },
    { id: 'a2', ownerId: 'a', status: 'draft', updatedAt: 3 }
  ]);
  await db.insert(pages__versions__$$locales).values([
    { id: 'l1', ownerId: 'a1', locale: 'en', title: 'Apple' },
    { id: 'l2', ownerId: 'm1', locale: 'en', title: 'Mango' },
    { id: 'l3', ownerId: 'a2', locale: 'en', title: 'Zebra' }
  ]);
});

/** The rows each document shows: its published version. */
const published = (versions: GenericTable) => eq(versions.status, 'published');

/** The ids of `slug`'s documents sorted by `by`, each read from the row `contentWhere` picks. */
const idsSortedBy = async (
  slug: 'news' | 'pages',
  by: string,
  contentWhere?: (versions: GenericTable) => any
) => {
  const root = tables[slug];
  const orderBy = buildOrderByParam({
    slug: slug as never,
    locale: 'en',
    tables,
    configCtx,
    by,
    versions: `${slug}__versions` as never,
    contentWhere,
    rootTable: root
  });
  const rows = await db
    .select({ id: root.id })
    .from(root)
    .orderBy(...orderBy);
  return rows.map((row) => row.id);
};

describe('a sort on a versioned list', () => {
  test('reads the value of the row each document shows', async () => {
    expect(await idsSortedBy('news', 'title', published)).toEqual(['a', 'm']);
    expect(await idsSortedBy('news', '-title', published)).toEqual(['m', 'a']);
  });

  test('reads a localized value from the row each document shows', async () => {
    expect(await idsSortedBy('pages', 'title', published)).toEqual(['a', 'm']);
  });

  test('reads the newest row when no row is named', async () => {
    expect(await idsSortedBy('news', 'title')).toEqual(['m', 'a']);
    expect(await idsSortedBy('pages', 'title')).toEqual(['m', 'a']);
  });

  test('refuses a field that is not a column', () => {
    expect(() =>
      buildOrderByParam({
        slug: 'news' as never,
        locale: 'en',
        tables,
        configCtx,
        by: 'titel',
        versions: 'news__versions' as never,
        rootTable: news
      })
    ).toThrow('"titel" is not a property of news to sort by');
  });
});
